import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OuncePriceCandle } from '@ounce24/types';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS } from '../consts';
import axios from 'axios';

@Injectable()
export class OuncePriceHistoryService implements OnModuleInit {
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

  async onModuleInit() {
    await this.backfillHistory();
  }

  async backfillHistory() {
    console.log('Checking local price history count for backfill...');
    try {
      const count = await this.candleModel.countDocuments().exec();
      // If we have less than 8000 candles (about 27.7 days of 5m data), trigger backfill
      if (count < 8000) {
        console.log(`Only ${count} candles found in local DB. Backfilling up to 30 days from TwelveData...`);
        const apiKey = process.env.TWELVE_DATA_API_KEY || '760ae215f3f94dcea4c2b43d33e4c022';
        
        let allValues: {
          datetime: string;
          open: string;
          high: string;
          low: string;
          close: string;
        }[] = [];

        // Fetch first batch of 5000 candles (~17 days)
        console.log('Fetching first batch of 5000 candles from TwelveData...');
        const response1 = await axios.get<{
          status: string;
          message?: string;
          values?: {
            datetime: string;
            open: string;
            high: string;
            low: string;
            close: string;
          }[];
        }>(
          `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=5min&outputsize=5000&timezone=UTC&apikey=${apiKey}`
        );

        if (response1.data.status !== 'ok') {
          throw new Error(response1.data.message || 'Unknown TwelveData API error in batch 1');
        }

        const values1 = response1.data.values || [];
        allValues = allValues.concat(values1);
        console.log(`Fetched ${values1.length} candles in first batch.`);

        // If we got the full outputsize, fetch the second batch prior to the oldest datetime
        if (values1.length === 5000) {
          const oldestDatetime = values1[values1.length - 1].datetime;
          console.log(`Fetching second batch of 5000 candles ending at ${oldestDatetime}...`);
          const response2 = await axios.get<{
            status: string;
            message?: string;
            values?: {
              datetime: string;
              open: string;
              high: string;
              low: string;
              close: string;
            }[];
          }>(
            `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=5min&outputsize=5000&end_date=${oldestDatetime}&timezone=UTC&apikey=${apiKey}`
          );

          if (response2.data.status === 'ok') {
            const values2 = response2.data.values || [];
            allValues = allValues.concat(values2);
            console.log(`Fetched ${values2.length} candles in second batch.`);
          } else {
            console.warn('Failed to fetch second batch of candles:', response2.data.message);
          }
        }

        console.log(`Writing total of ${allValues.length} candles to local DB...`);
        const bulkOps = allValues.map((val) => {
          const timestamp = new Date(val.datetime + 'Z'); // Parse as UTC datetime
          const open = parseFloat(val.open);
          const high = parseFloat(val.high);
          const low = parseFloat(val.low);
          const close = parseFloat(val.close);

          return {
            updateOne: {
              filter: { timestamp },
              update: { $set: { open, high, low, close } },
              upsert: true,
            },
          };
        });

        if (bulkOps.length > 0) {
          await this.candleModel.bulkWrite(bulkOps);
          console.log(`Successfully backfilled ${bulkOps.length} price history candles from TwelveData.`);
        }
      } else {
        console.log(`Local price history has ${count} candles. Skipping backfill.`);
      }
    } catch (error: any) {
      console.error('Failed to backfill price history from TwelveData:', error.message || error);
    }
  }

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

  async getHistory(limit = 10000): Promise<OuncePriceCandle[]> {
    return this.candleModel.find().sort({ timestamp: 1 }).limit(limit).exec();
  }
}
