import { Injectable } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf, Telegram } from 'telegraf';

@Injectable()
export class PublishBotsService {
  private actionQueue: [string, (telegram: Telegram) => void][] = [];

  constructor(
    @InjectBot('publish1') private publish1bot: Telegraf<Context>,
    @InjectBot('publish2') private publish2bot: Telegraf<Context>
  ) {
    const publishBots = [this.publish1bot, this.publish2bot];

    for (let i = 0; i < publishBots.length; i++) {
      const bot = publishBots[i];
      setTimeout(() => {
        setInterval(() => {
          if (this.actionQueue.length) {
            const action = this.actionQueue.shift();
            action[1](bot.telegram);
          }
        }, 3000);
      }, i * 1000);
    }
  }

  addAction(key: string, func: (telegram: Telegram) => void) {
    const existAction = this.actionQueue.find((x) => x[0] === key);

    if (existAction) existAction[1] = func;
    else this.actionQueue.push([key, func]);
  }
}
