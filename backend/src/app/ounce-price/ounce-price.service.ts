import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { TvApiAdapter } from 'tradingview-api-adapter';
import { QuoteService } from './quote.service';
import { EVENTS } from '../consts';
import { OuncePriceHistoryService } from './ounce-price-history.service';

export const OUNCE_PRICE_UPDATED = 'ounce.price';

@Injectable()
export class OuncePriceService implements OnModuleInit {
  private currentPrice = 0;
  /** Single source of truth for market open/closed state. Initialized on startup, toggled by crons. */
  private marketOpen: boolean;
  adapter = new TvApiAdapter();

  constructor(
    private quoteService: QuoteService,
    private eventEmitter: EventEmitter2,
    private historyService: OuncePriceHistoryService,
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

  async onModuleInit() {
    try {
      const latestPrice = await this.historyService.getLatestPrice();
      if (latestPrice && latestPrice > 0) {
        this.currentPrice = latestPrice;
        this.eventEmitter.emit(EVENTS.OUNCE_PRICE_UPDATED, latestPrice);
      }
    } catch (error) {
      console.error('Failed to load initial price from history database:', error);
    }
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

  private calculateMarketOpen(date: Date): boolean {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour12: false,
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
    });

    const parts = formatter.formatToParts(date);
    const weekday = parts.find((p) => p.type === 'weekday')!.value;
    const hour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);

    const timeInHours = hour + minute / 60;

    if (weekday === 'Saturday') {
      return false;
    }
    if (weekday === 'Sunday') {
      return timeInHours >= 18;
    }
    if (weekday === 'Friday') {
      return timeInHours < 17;
    }
    return timeInHours < 17 || timeInHours >= 18;
  }

  /** Fired at 17:00 America/New_York Mon–Fri (market daily break / weekend close on Fri). */
  @Cron('0 17 * * 1-5', { timeZone: 'America/New_York' })
  triggerMarketClose() {
    this.marketOpen = false;
    this.eventEmitter.emit(EVENTS.MARKET_CLOSED);
  }

  /** Fired at 18:00 America/New_York Sun–Thu (market reopens after daily break). */
  @Cron('0 18 * * 0-4', { timeZone: 'America/New_York' })
  triggerMarketOpen() {
    this.marketOpen = true;
    this.eventEmitter.emit(EVENTS.MARKET_OPENED);
  }
}


