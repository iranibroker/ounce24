import { Injectable } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { Redis } from 'ioredis';

@Injectable()
export class OuncePublishBotService {
  constructor(
    @InjectBot('main') private bot: Telegraf<Context>,
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
        if (publishChannelMessageId) {
          this.bot.telegram
            .editMessageText(
              process.env.PUBLISH_CHANNEL_ID,
              publishChannelMessageId,
              undefined,
              `قیمت لحظه‌ای اونس طلا: ${price}`
            )
            .catch((er) => {
              console.log('OuncePublishBotService', er);
              publishChannelMessageId = 0;
            });
        } else {
          this.bot.telegram.unpinAllChatMessages(
            process.env.PUBLISH_CHANNEL_ID
          );
          this.bot.telegram
            .sendMessage(
              process.env.PUBLISH_CHANNEL_ID,
              `قیمت لحظه‌ای اونس طلا: ${price}`
            )
            .then((message) => {
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
