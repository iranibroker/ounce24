import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '@ounce24/types';
import { Model } from 'mongoose';
import { Ctx, InjectBot, On, Start, Update } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { BaseBot, UserStateType } from './base-bot';
import { SignalBotService } from './signal-bot.service';

@Injectable()
@Update()
export class BotService extends BaseBot {
  constructor(
    @InjectBot('main') private bot: Telegraf<Context>,
    @InjectModel(User.name) private userModel: Model<User>,
    private signalBot: SignalBotService
  ) {
    super(userModel);
    this.bot.telegram
            .sendMessage(
              process.env.PUBLISH_CHANNEL_ID,
              `بروزرسانی جدید انجام شد`
            )
  }

  @Start()
  start(@Ctx() ctx: Context) {
    this.welcome(ctx);
  }

  @On('message')
  async onMessage(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const userState = this.getState(ctx.from.id);
    switch (userState?.state) {
      case UserStateType.NewSignal:
        this.signalBot.handleNewSignalMessage(ctx);
        break;

      default:
        this.welcome(ctx);
        break;
    }
  }
}
