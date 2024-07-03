import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '@ounce24/types';
import { Model } from 'mongoose';
import { Action, Command, Ctx, InjectBot, On, Start, Update } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { BaseBot, UserStateType } from './base-bot';
import { SignalBotService } from './signal-bot.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
@Update()
export class BotService extends BaseBot {
  constructor(
    @InjectBot('main') private bot: Telegraf<Context>,
    @InjectModel(User.name) private userModel: Model<User>,
    private signalBot: SignalBotService,
    private auth: AuthService
  ) {
    super(userModel, auth, bot);
    // this.bot.telegram
    //         .sendMessage(
    //           process.env.PUBLISH_CHANNEL_ID,
    //           `بروزرسانی جدید انجام شد`
    //         )
  }

  @Start()
  start(@Ctx() ctx: Context) {
    this.welcome(ctx);
  }

  @Command('support')
  support(@Ctx() ctx: Context) {
    ctx.reply(`من یک رباتم نمیتونم پشتیبانی بدم!
ولی نظراتت رو میتونم بررسی کنم و کارم رو بهبود بدم
پس اگه نظری داری برام بنویس`);
    this.setState(ctx.from.id, {
      state: UserStateType.Support,
    });
  }

  async sendSupportMessage(ctx: Context) {
    const user = await this.getUser(ctx.from.id);
    const text = ctx.message['text'];
    if (process.env.ADMIN_IDS) {
      const ids = process.env.ADMIN_IDS.split(',');
      for (const admin of ids) {
        this.bot.telegram.sendMessage(
          admin,
          `${user.tag}\n${user.name}:\n\n${text}`
        );
      }
    }
    await ctx.reply(
      'پیام شما با موفقیت به مدیریت ارسال شد. ممنون از ثبت نظر شما'
    );
    await ctx.sendChatAction('typing');
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
      case UserStateType.Support:
        this.sendSupportMessage(ctx);
        break;

      default:
        this.welcome(ctx);
        break;
    }
  }
}
