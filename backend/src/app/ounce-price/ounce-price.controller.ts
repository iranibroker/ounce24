import { Controller, Get, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OuncePriceService } from './ounce-price.service';

@Controller('ounce-price')
export class OuncePriceController {
  constructor(private readonly ouncePriceService: OuncePriceService) {}

  @Get('current')
  getCurrentPrice() {
    return {
      price: this.ouncePriceService.current,
    };
  }

  @Sse('stream')
  streamPrice(): Observable<MessageEvent> {
    return this.ouncePriceService.obs.pipe(
      map((price) => ({
        data: { price },
        type: 'message',
      } as MessageEvent)),
    );
  }
} 