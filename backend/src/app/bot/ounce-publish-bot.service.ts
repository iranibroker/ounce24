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
    process.env.REDIS_URI + process.env.REDIS_APP_CONFIG_DB,
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
          `🟡 Gold price: ${price}`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Signal list',
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
          `Gold price: ${price}`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Signal list',
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
