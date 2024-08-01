import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SignalStatus, User } from '@ounce24/types';
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
  @Command('cancel')
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

  @Command('search_r9')
  async searchCommand(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;

    this.setState(ctx.from.id, {
      state: UserStateType.SearchUser,
      data: ctx.message['text'],
    });
    ctx.reply(`لطفا عبارت جستجو خود را وارد کنید\n/cancel`);
  }

  async search(ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const query = ctx.message['text'];
    const searchQuery = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
      ],
    };
    const users = await this.userModel.find(searchQuery).exec();
    const count = users.length;
    const first5 = users.slice(0, 5);
    this.deleteState(ctx.from.id);
    ctx.reply(`کاربران یافت شده ${count} نفر:`, {
      reply_markup: {
        inline_keyboard: first5.map((x) => [
          {
            text: `${x.title} (${x.name} - ${x.phone})`,
            callback_data: `user_closed_signals:::${x.id}`,
          },
        ]),
      },
    });
  }

  @Command('send_message_to_all_d3')
  async sendMessageToAll(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;

    this.setState(ctx.from.id, { state: UserStateType.SendMessageToAll });
    ctx.reply(`لطفا پیام مورد نظر خود را وارد کنید\n/cancel`);
  }

  async sendMessage(ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const allUsers = await this.userModel.find().exec();
    for (const user of allUsers) {
      if (user.telegramId) await ctx.copyMessage(user.telegramId);
    }
    this.deleteState(ctx.from.id);
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
      case UserStateType.SendMessageToAll:
        this.sendMessage(ctx);
        break;
      case UserStateType.SearchUser:
        this.search(ctx);
        break;

      default:
        this.welcome(ctx);
        break;
    }
  }

  @On('callback_query')
  onCallback(@Ctx() ctx: Context) {
    const key = ctx.callbackQuery['data'].split(':::')[0];
    const value = ctx.callbackQuery['data'].split(':::')[1];
    switch (key) {
      case 'user_closed_signals':
        this.signalBot.myClosedSignals(ctx, 10, 0, value);
        break;
      case 'user_closed_signals_all':
        this.signalBot.myClosedSignals(ctx, 100, 10, value);
        break;

      default:
        break;
    }
    ctx.answerCbQuery();
  }
}
