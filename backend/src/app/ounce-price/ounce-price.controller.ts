import { Controller, Get, Sse, MessageEvent, Query, Res, OnModuleInit } from '@nestjs/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OuncePriceService } from './ounce-price.service';
import { OuncePriceHistoryService } from './ounce-price-history.service';
import { EVENTS } from '../consts';
import { OnEvent } from '@nestjs/event-emitter';
import { Public } from '../auth/public.decorator';
import { Response } from 'express';

@Public()
@Controller('ounce-price')
export class OuncePriceController implements OnModuleInit {
  obs = new BehaviorSubject<number>(0);
  constructor(
    private readonly ouncePriceService: OuncePriceService,
    private readonly historyService: OuncePriceHistoryService,
  ) {}

  onModuleInit() {
    if (this.ouncePriceService.current > 0) {
      this.obs.next(this.ouncePriceService.current);
    }
  }

  @Get('history')
  async getHistory(
    @Query('format') format: string,
    @Query('limit') limitStr: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 10000;
    const history = await this.historyService.getHistory(limit);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=gold_price_history.csv',
      );

      const headers = ['Timestamp', 'Open', 'High', 'Low', 'Close'];
      const rows = history.map((c) =>
        [
          c.timestamp instanceof Date
            ? c.timestamp.toISOString()
            : new Date(c.timestamp).toISOString(),
          c.open,
          c.high,
          c.low,
          c.close,
        ].join(','),
      );
      return [headers.join(','), ...rows].join('\n');
    }

    // Default to JSON
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=gold_price_history.json',
    );
    return history;
  }

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
