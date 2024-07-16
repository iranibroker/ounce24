import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { Redis } from 'ioredis';

const MAX_ERROR = 5;

@Injectable()
export class OuncePublishBotService {
  private errorCount = 0;
  private prevPrice = 0;
  prevPublishDatetime = 0;
  constructor(
    @InjectBot('ounce') private bot: Telegraf<Context>,
    private ouncePriceService: OuncePriceService
  ) {
    let publishChannelMessageId = 0;
    const redis = new Redis(
      process.env.IS_DEV
        ? 'redis://:X7Y5T2sFNrdcn28h4JLURCKQkgVBynbc@075b5acd-5c6f-4d3e-8682-6f05b1d15743.hsvc.ir:31944/1'
        : process.env.REDIS_URI
    );

    redis.get('publicChannelOuncePriceMessageId', (err, result) => {
      if (result) {
        publishChannelMessageId = Number(result);
      }

      this.ouncePriceService.obs.subscribe((price) => {
        if (price === this.prevPrice) return;
        this.prevPrice = price;
        if (publishChannelMessageId) {
          const diff = Date.now() - this.prevPublishDatetime;
          if (diff < 10000) return;
          console.log('diff', diff);
          this.prevPublishDatetime = Date.now();
          this.bot.telegram
            .editMessageText(
              process.env.PUBLISH_CHANNEL_ID,
              publishChannelMessageId,
              undefined,
              `🟡 قیمت لحظه‌ای انس طلا: ${price}`
            )
            .then(() => {
              this.errorCount = 0;
            })
            .catch((er) => {
              console.error(
                'OuncePublishBotService',
                this.errorCount,
                er.response.error_code,
                er
              );
              if (er.response.error_code !== 429) this.errorCount++;
              if (this.errorCount === MAX_ERROR) {
                this.bot.telegram
                  .deleteMessage(
                    process.env.PUBLISH_CHANNEL_ID,
                    publishChannelMessageId
                  )
                  .catch(() => {
                    // unhandled
                  });
                publishChannelMessageId = 0;
              }
            });
        } else {
          this.bot.telegram.unpinAllChatMessages(
            process.env.PUBLISH_CHANNEL_ID
          );
          this.bot.telegram
            .sendMessage(
              process.env.PUBLISH_CHANNEL_ID,
              `قیمت لحظه‌ای انس طلا: ${price}`
            )
            .then((message) => {
              this.errorCount = 0;
              publishChannelMessageId = message.message_id;
              redis.set(
                'publicChannelOuncePriceMessageId',
                publishChannelMessageId
              );
              this.bot.telegram.pinChatMessage(
                process.env.PUBLISH_CHANNEL_ID,
                message.message_id
              );
            });
        }
      });
    });
  }
}
