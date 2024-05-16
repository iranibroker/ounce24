import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { BehaviorSubject } from 'rxjs';

const REDIS_CHANNEL = 'xauusd-channel';

@Injectable()
export class OuncePriceService {
  private readonly redis: Redis;
  private price = new BehaviorSubject<number>(0);

  constructor() {
    this.redis = new Redis(process.env.REDIS_URI);

    this.redis.subscribe(REDIS_CHANNEL);

    this.redis.on('message', (channel, message) => {
      if (channel === REDIS_CHANNEL) {
        const price = Number(message);
        this.price.next(price);
      }
    });
  }

  get obs() {
    return this.price.asObservable();
  }

  get current() {
    return this.price.value;
  }
}
