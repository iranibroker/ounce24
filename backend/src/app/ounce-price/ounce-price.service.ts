import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TvApiAdapter } from 'tradingview-api-adapter';
import { QuoteService } from './quote.service';

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
        console.log(price);
        this.eventEmitter.emit(OUNCE_PRICE_UPDATED, price);
      }
    });
  }

  get current() {
    return this.currentPrice;
  }
}
