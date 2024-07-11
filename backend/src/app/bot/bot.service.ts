import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '@ounce24/types';
import { Model } from 'mongoose';
import {
  Action,
  Command,
  Ctx,
  InjectBot,
  On,
  Start,
  Update,
} from 'nestjs-telegraf';
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

  @Command('bank')
  onIban(@Ctx() ctx: Context) {
    ctx.reply(`لطفا جهت دریافت جوایز یک شماره شبا وارد کنید:`, {
      reply_markup: { remove_keyboard: true },
    });
    this.setState(ctx.from.id, {
      state: UserStateType.Iban,
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

  async setIban(ctx: Context) {
    const fromId = ctx.from.id;
    const user = await this.getUser(fromId);
    const iban: string = ctx.message['text'];
    iban.replace('IR', '');
    iban.replace('ir', '');
    iban.replace('Ir', '');
    await ctx.sendChatAction('typing');
    if (iban.length !== 24) {
      ctx.reply(
        `شماره شبا وارد شده صحیح نیست. لطفا شماره شبای صحیح را وارد کنید:`
      );
    } else {
      await this.userModel.findByIdAndUpdate(user.id, { iban }).exec();
      ctx.reply('✅ شماره شبای شما ثبت شد');
      this.deleteState(fromId);
    }
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
      case UserStateType.Iban:
        this.setIban(ctx);
        break;

      default:
        this.welcome(ctx);
        break;
    }
  }
}
