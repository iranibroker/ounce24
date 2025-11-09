import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Redis } from 'ioredis';

import { EVENTS } from '../consts';
import { OuncePriceService } from '../ounce-price/ounce-price.service';

// Sorted-set key used to store all alarms ordered by their target price.
// We intentionally keep a single key to allow efficient range queries with ZRANGEBYSCORE.
const ALARMS_KEY = 'ounce:alarms';

/**
 * Runtime representation of a single registered ounce alarm.
 *
 * We keep the payload minimal: the consumer already knows which commodity
 * we are working with, so only `userId` and `targetPrice` are required.
 */
export interface OunceAlarmPayload {
  userId: string;
  targetPrice: number;
}

/**
 * OunceAlarmsService
 *
 * Responsibilities
 * - Registers alarms in Redis whenever the user requests a new target price.
 * - Listens for ounce price ticks and emits `OUNCE_ALARM_TRIGGERED` when a tick crosses
 *   any stored target prices.
 * - Cleans up alarms immediately after the trigger so Redis only holds active alarms.
 *
 * Design rationale
 * - A single sorted-set key (`ounce:alarms`) keeps alarms ordered by target price, which
 *   makes `ZRANGEBYSCORE` perfect for finding all alarms between two price ticks.
 * - We use a dedicated Redis DB (configurable via `REDIS_ALARMS_DB`) to isolate alarms
 *   from other application data, simplifying purges and observability.
 */
@Injectable()
export class OunceAlarmsService implements OnModuleDestroy {
  private static readonly logger = new Logger(OunceAlarmsService.name);
  private readonly redis: Redis;
  private lastPrice: number;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly ouncePriceService: OuncePriceService,
  ) {
    this.redis = new Redis(OunceAlarmsService.buildRedisUrl());
    this.lastPrice = this.ouncePriceService.current;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      OunceAlarmsService.logger.warn(
        'Failed to gracefully close Redis connection',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async createAlarm(userId: string, targetPrice: number): Promise<void> {
    if (!userId) {
      throw new BadRequestException('userId is required to create an alarm');
    }
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      throw new BadRequestException('targetPrice must be greater than 0');
    }

    const payload: OunceAlarmPayload = { userId, targetPrice };
    // `ZADD` stores the payload ordered by `targetPrice`, enabling O(log N) insertions
    // and efficient lookups using score ranges.
    await this.redis.zadd(ALARMS_KEY, targetPrice, JSON.stringify(payload));
  }

  async cancelAlarm(userId: string, targetPrice: number): Promise<boolean> {
    if (!userId || !Number.isFinite(targetPrice)) {
      return false;
    }
    const payload: OunceAlarmPayload = { userId, targetPrice };
    const removed = await this.redis.zrem(ALARMS_KEY, JSON.stringify(payload));
    return removed > 0;
  }

  /**
   * Removes every stored alarm.
   *
   * We rely on a dedicated Redis DB, so dropping the single sorted-set key
   * is an efficient way to clear all alarms without touching other modules.
   */
  async clearAllAlarms(): Promise<void> {
    await this.redis.del(ALARMS_KEY);
  }

  async getAlarms(): Promise<OunceAlarmPayload[]> {
    const members = await this.redis.zrange(ALARMS_KEY, 0, -1);
    return members.map((member) => this.parseMember(member)).filter(Boolean);
  }

  async getAlarmsByUser(userId: string): Promise<OunceAlarmPayload[]> {
    if (!userId) {
      return [];
    }
    const alarms = await this.getAlarms();
    return alarms.filter((alarm) => alarm.userId === userId);
  }

  @OnEvent(EVENTS.OUNCE_PRICE_UPDATED)
  async handleOuncePriceUpdated(currentPrice: number): Promise<void> {
    if (!Number.isFinite(currentPrice) || currentPrice === 0) {
      return;
    }

    const previousPrice = this.lastPrice ?? currentPrice;
    if (previousPrice === currentPrice) {
      return;
    }

    const [min, max] =
      previousPrice < currentPrice
        ? [previousPrice, currentPrice]
        : [currentPrice, previousPrice];

    try {
      // Fetch alarms whose scores sit between the previous and current price.
      this.redis.zrangebyscore(ALARMS_KEY, min, max).then(async (members) => {
        if (members.length === 0) {
          return;
        }

        // Remove all matched alarms in a batch to avoid round trips.
        const pipeline = this.redis.pipeline();
        members.forEach((member) => pipeline.zrem(ALARMS_KEY, member));
        await pipeline.exec();

        members
          .map((member) => this.parseMember(member))
          .filter<OunceAlarmPayload>(
            (payload): payload is OunceAlarmPayload => payload !== undefined,
          )
          .forEach((payload) =>
            this.eventEmitter.emit(EVENTS.OUNCE_ALARM_TRIGGERED, payload),
          );
      });
    } catch (error) {
      OunceAlarmsService.logger.error(
        'Failed to process ounce price alarms',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.lastPrice = currentPrice;
    }
  }

  private static buildRedisUrl(): string {
    return process.env.REDIS_URI + process.env.REDIS_APP_CONFIG_DB;
  }

  private parseMember(member: string): OunceAlarmPayload | undefined {
    try {
      const parsed = JSON.parse(member) as Partial<OunceAlarmPayload>;
      if (
        parsed &&
        typeof parsed.userId === 'string' &&
        typeof parsed.targetPrice === 'number'
      ) {
        return {
          userId: parsed.userId,
          targetPrice: parsed.targetPrice,
        };
      }
    } catch (error) {
      OunceAlarmsService.logger.warn(
        `Unable to parse ounce alarm payload: ${member}`,
      );
    }
    return undefined;
  }
}
