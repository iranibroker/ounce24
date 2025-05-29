import { Controller, Get, Sse, MessageEvent } from '@nestjs/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OuncePriceService } from './ounce-price.service';
import { EVENTS } from '../consts';
import { OnEvent } from '@nestjs/event-emitter';

@Controller('ounce-price')
export class OuncePriceController {
  obs = new BehaviorSubject<number>(0);
  constructor(private readonly ouncePriceService: OuncePriceService) {}

  @Get('current')
  getCurrentPrice() {
    return {
      price: this.ouncePriceService.current,
    };
  }

  @Sse('stream')
  streamPrice(): Observable<MessageEvent> {
    return this.obs.pipe(
      map(
        (price) =>
          ({
            data: { price },
            type: 'message',
          }) as MessageEvent,
      ),
    );
  }

  @OnEvent(EVENTS.OUNCE_PRICE_UPDATED)
  handleOuncePriceUpdated(price: number) {
    this.obs.next(price);
  }
}
