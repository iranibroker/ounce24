import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OuncePriceCandle } from '@ounce24/types';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS } from '../consts';

@Injectable()
export class OuncePriceHistoryService {
  private currentCandle: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
  } | null = null;
  private lastWriteTime = 0;

  constructor(
    @InjectModel(OuncePriceCandle.name)
    private candleModel: Model<OuncePriceCandle>,
  ) {}

  @OnEvent(EVENTS.OUNCE_PRICE_UPDATED)
  async handleOuncePriceUpdated(price: number) {
    if (!price || price <= 0) return;

    // Align to the start of the 5-minute interval
    const candleTimeMs = Math.floor(Date.now() / (5 * 60 * 1000)) * (5 * 60 * 1000);

    if (!this.currentCandle || this.currentCandle.timestamp !== candleTimeMs) {
      // Save old candle first before creating a new one
      if (this.currentCandle) {
        await this.saveCandleToDb(this.currentCandle);
      }

      try {
        // Resume existing candle from DB if it exists (e.g. server restarted during the 5-min interval)
        const existing = await this.candleModel.findOne({ timestamp: new Date(candleTimeMs) }).exec();
        if (existing) {
          this.currentCandle = {
            timestamp: candleTimeMs,
            open: existing.open,
            high: Math.max(existing.high, price),
            low: Math.min(existing.low, price),
            close: price,
          };
        } else {
          this.currentCandle = {
            timestamp: candleTimeMs,
            open: price,
            high: price,
            low: price,
            close: price,
          };
        }
      } catch (error) {
        console.error('Error fetching existing candle on tick initiation:', error);
        this.currentCandle = {
          timestamp: candleTimeMs,
          open: price,
          high: price,
          low: price,
          close: price,
        };
      }
      await this.saveCandleToDb(this.currentCandle);
    } else {
      this.currentCandle.close = price;
      this.currentCandle.high = Math.max(this.currentCandle.high, price);
      this.currentCandle.low = Math.min(this.currentCandle.low, price);

      const now = Date.now();
      if (now - this.lastWriteTime > 15000) { // Write at most once every 15 seconds to avoid database spam
        await this.saveCandleToDb(this.currentCandle);
      }
    }
  }

  private async saveCandleToDb(candle: { timestamp: number; open: number; high: number; low: number; close: number }) {
    try {
      await this.candleModel.updateOne(
        { timestamp: new Date(candle.timestamp) },
        {
          $set: {
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          },
        },
        { upsert: true }
      ).exec();
      this.lastWriteTime = Date.now();
    } catch (error) {
      console.error('Error saving candle to DB:', error);
    }
  }
}
