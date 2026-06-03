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
  adapter = new TvApiAdapter();

  constructor(
    private quoteService: QuoteService,
    private eventEmitter: EventEmitter2,
  ) {
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

  isMarketOpen(date: Date = new Date()): boolean {
    const day = date.getUTCDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
    const hour = date.getUTCHours();

    if (day === 6) { // Saturday
      return false;
    }
    if (day === 0) { // Sunday
      return hour >= 22;
    }
    if (day === 5) { // Friday
      return hour < 22;
    }
    return true; // Monday, Tuesday, Wednesday, Thursday
  }

  @Cron('0 22 * * 1-5', { timeZone: 'UTC' })
  triggerMarketClose() {
    this.eventEmitter.emit(EVENTS.MARKET_CLOSED);
  }

  @Cron('0 23 * * 0-4', { timeZone: 'UTC' })
  triggerMarketOpen() {
    this.eventEmitter.emit(EVENTS.MARKET_OPENED);
  }
}

