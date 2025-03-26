import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { BehaviorSubject } from 'rxjs';
import { TvApiAdapter } from 'tradingview-api-adapter';

const REDIS_CHANNEL = 'xauusd-channel';

@Injectable()
export class OuncePriceService {
  private readonly redis: Redis;
  private price = new BehaviorSubject<number>(2800);
  adapter = new TvApiAdapter();

  constructor() {
    // this.redis = new Redis(process.env.REDIS_URI);

    // this.redis.subscribe(REDIS_CHANNEL);

    // this.redis.on('message', (channel, message) => {
    //   if (channel === REDIS_CHANNEL) {
    //     const oldPrice = this.current;
    //     const price = Number(message);
    //     if (price != oldPrice) this.price.next(price);
    //   }
    // });

    this.adapter.Quote('XAUUSD', 'OANDA', ['lp']).listen((data) => {
      const oldPrice = this.current;
      const price = Number(data.lp);
      if (price != oldPrice) this.price.next(price);
    });
  }

  get obs() {
    return this.price.asObservable();
  }

  get current() {
    return this.price.value;
  }
}
