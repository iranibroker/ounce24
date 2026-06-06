import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { TvApiAdapter } from 'tradingview-api-adapter';
import { QuoteService } from './quote.service';
import { EVENTS } from '../consts';

export const OUNCE_PRICE_UPDATED = 'ounce.price';

@Injectable()
export class OuncePriceService {
  private currentPrice = 0;
  /** Single source of truth for market open/closed state. Initialized on startup, toggled by crons. */
  private marketOpen: boolean;
  adapter = new TvApiAdapter();

  constructor(
    private quoteService: QuoteService,
    private eventEmitter: EventEmitter2,
  ) {
    // Initialize market state from current UTC time on startup
    this.marketOpen = this.calculateMarketOpen(new Date());

    this.quoteService.data.subscribe((data) => {
      const oldPrice = this.currentPrice;
      const price = data;
      if (price != oldPrice) {
        this.currentPrice = price;
        this.eventEmitter.emit(OUNCE_PRICE_UPDATED, price);
      }
    });
  }

  get current() {
    return this.currentPrice;
  }

  /**
   * Returns the current stored market open/closed state (source of truth).
   * If a specific `date` is provided, computes dynamically for that date
   * (useful for historic/future queries from other services).
   */
  isMarketOpen(date?: Date): boolean {
    if (!date) {
      return this.marketOpen;
    }
    return this.calculateMarketOpen(date);
  }

  /** Pure UTC calculation — no side effects. */
  private calculateMarketOpen(date: Date): boolean {
    const day = date.getUTCDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
    const hour = date.getUTCHours();

    // Daily break: 22:00 to 23:00 UTC is always closed
    if (hour === 22) return false;

    // Weekend close: Friday 22:00 UTC to Sunday 23:00 UTC
    if (day === 6) return false;          // Saturday: always closed
    if (day === 0) return hour >= 23;     // Sunday: open from 23:00 UTC
    if (day === 5) return hour < 22;      // Friday: close at 22:00 UTC
    return true;                          // Mon, Tue, Wed, Thu
  }

  /** Fired at 22:00 UTC Mon–Fri (market daily break / weekend close on Fri). */
  @Cron('0 22 * * 1-5', { timeZone: 'UTC' })
  triggerMarketClose() {
    this.marketOpen = false;
    this.eventEmitter.emit(EVENTS.MARKET_CLOSED);
  }

  /** Fired at 23:00 UTC Sun–Thu (market reopens after daily break). */
  @Cron('0 23 * * 0-4', { timeZone: 'UTC' })
  triggerMarketOpen() {
    this.marketOpen = true;
    this.eventEmitter.emit(EVENTS.MARKET_OPENED);
  }
}


