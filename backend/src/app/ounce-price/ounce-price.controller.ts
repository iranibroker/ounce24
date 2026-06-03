import { Controller, Get, Sse, MessageEvent } from '@nestjs/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OuncePriceService } from './ounce-price.service';
import { EVENTS } from '../consts';
import { OnEvent } from '@nestjs/event-emitter';
import { Public } from '../auth/public.decorator';

@Public()
@Controller('ounce-price')
export class OuncePriceController {
  obs = new BehaviorSubject<number>(0);
  constructor(private readonly ouncePriceService: OuncePriceService) {}

  @Get('current')
  getCurrentPrice() {
    return {
      price: this.ouncePriceService.current,
      isMarketOpen: this.ouncePriceService.isMarketOpen(),
    };
  }

  @Sse('stream')
  streamPrice(): Observable<MessageEvent> {
    return this.obs.pipe(
      map(
        (price) =>
          ({
            data: {
              price,
              isMarketOpen: this.ouncePriceService.isMarketOpen(),
            },
            type: 'message',
          }) as MessageEvent,
      ),
    );
  }

  @OnEvent(EVENTS.OUNCE_PRICE_UPDATED)
  handleOuncePriceUpdated(price: number) {
    this.obs.next(price);
  }

  @OnEvent(EVENTS.MARKET_CLOSED)
  handleMarketClosed() {
    this.obs.next(this.ouncePriceService.current);
  }

  @OnEvent(EVENTS.MARKET_OPENED)
  handleMarketOpened() {
    this.obs.next(this.ouncePriceService.current);
  }
}
