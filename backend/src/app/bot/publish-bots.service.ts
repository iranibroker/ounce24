import { Injectable } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf, Telegram } from 'telegraf';
import { BOT_KEYS } from '../configs/publisher-bots.config';

@Injectable()
export class PublishBotsService {
  private botActionQueue: {
    [key: string]: [string, (telegram: Telegram) => void][];
  } = {};

  constructor(
    @InjectBot(BOT_KEYS[0]) private publish1bot: Telegraf<Context>,
    @InjectBot(BOT_KEYS[1]) private publish2bot: Telegraf<Context>
  ) {
    const publishBots = [this.publish1bot, this.publish2bot];

    for (let i = 0; i < publishBots.length; i++) {
      const bot = publishBots[i];
      this.botActionQueue[BOT_KEYS[i]] = [];
      setTimeout(() => {
        setInterval(() => {
          const queue = this.botActionQueue[BOT_KEYS[i]];
          if (queue.length) {
            const action = queue.shift();
            action[1](bot.telegram);
          }
        }, 3000);
      }, i * 1000);
    }
  }

  addAction(bot: string, key: string, func: (telegram: Telegram) => void) {
    const queue = this.botActionQueue[bot];
    const existAction = queue.find((x) => x[0] === key);

    if (existAction) existAction[1] = func;
    else queue.push([key, func]);
  }
}
