import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { Redis } from 'ioredis';
import { EVENTS } from '../consts';
import { OnEvent } from '@nestjs/event-emitter';

const MAX_ERROR = 3;

const APP_URL = process.env.APP_URL || 'https://app.ounce24.com';

@Injectable()
export class OuncePublishBotService {
  private errorCount = 0;
  private prevPrice = 0;
  prevPublishDatetime = 0;
  publishChannelMessageId = 0;
  redis: Redis = new Redis(
    process.env.IS_DEV
      ? 'redis://:X7Y5T2sFNrdcn28h4JLURCKQkgVBynbc@075b5acd-5c6f-4d3e-8682-6f05b1d15743.hsvc.ir:31944/1'
      : process.env.REDIS_URI,
  );
  constructor(@InjectBot('ounce') private bot: Telegraf<Context>) {
    this.redis.get('publicChannelOuncePriceMessageId', (err, result) => {
      if (result) {
        this.publishChannelMessageId = Number(result);
      }
    });
  }

  @OnEvent(EVENTS.OUNCE_PRICE_UPDATED)
  handleOuncePriceUpdated(price: number) {
    if (price === this.prevPrice) return;
    this.prevPrice = price;
    if (this.publishChannelMessageId) {
      const diff = Date.now() - this.prevPublishDatetime;
      if (diff < 8000) return;
      this.prevPublishDatetime = Date.now();
      this.bot.telegram
        .editMessageText(
          process.env.PUBLISH_CHANNEL_ID,
          this.publishChannelMessageId,
          undefined,
          `🟡 قیمت لحظه‌ای انس طلا: ${price}`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'لیست سیگنال‌ها',
                    url: APP_URL,
                  },
                ],
              ],
            },
          },
        )
        .then(() => {
          this.errorCount = 0;
        })
        .catch((er) => {
          console.error(
            'OuncePublishBotService',
            this.errorCount,
            er.response.error_code,
            er,
          );
          if (er.response.error_code !== 429) this.errorCount++;
          if (this.errorCount === MAX_ERROR) {
            this.bot.telegram
              .deleteMessage(
                process.env.PUBLISH_CHANNEL_ID,
                this.publishChannelMessageId,
              )
              .catch(() => {
                // unhandled
              });
            this.publishChannelMessageId = 0;
          }
        });
    } else {
      this.bot.telegram.unpinAllChatMessages(process.env.PUBLISH_CHANNEL_ID);
      this.bot.telegram
        .sendMessage(
          process.env.PUBLISH_CHANNEL_ID,
          `قیمت لحظه‌ای انس طلا: ${price}`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'لیست سیگنال‌ها',
                    url: APP_URL,
                  },
                ],
              ],
            },
          },
        )
        .then((message) => {
          this.errorCount = 0;
          this.publishChannelMessageId = message.message_id;
          this.redis.set(
            'publicChannelOuncePriceMessageId',
            this.publishChannelMessageId,
          );
          this.bot.telegram.pinChatMessage(
            process.env.PUBLISH_CHANNEL_ID,
            message.message_id,
          );
        });
    }
  }
}
