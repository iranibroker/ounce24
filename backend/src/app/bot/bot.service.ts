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
import { ConsultingBotService } from './consulting-bot.service';
import { Public } from '../auth/public.decorator';
import { OunceAlarmBotService } from './ounce-alarm-bot.service';

const APP_URL = process.env.APP_URL || 'https://app.ounce24.com';

@Public()
@Injectable()
@Update()
export class BotService extends BaseBot {
  constructor(
    @InjectBot('main') private bot: Telegraf<Context>,
    @InjectModel(User.name) private userModel: Model<User>,
    private signalBot: SignalBotService,
    private consultingBot: ConsultingBotService,
    private auth: AuthService,
    private ounceAlarmBot: OunceAlarmBotService,
  ) {
    super(userModel, auth, bot);
  }

  @Start()
  @Command('cancel')
  start(@Ctx() ctx: Context) {
    this.welcome(ctx);
  }

  @Action('welcome_signal')
  welcomeSignalAction(@Ctx() ctx: Context) {
    this.welcomeSignal(ctx);
  }

  @Command('temp_link')
  tempLink(@Ctx() ctx: Context) {
    ctx.reply(
      `📍 See other traders' positions

📊 Trading gold?
With Ounce24 you can share signals and use others' signals too!

We gather the best trading ideas from the market—free and practical.

✅ Active channel members' signals
✅ Compare analyses and strategies
✅ Get noticed and learn

🎯 Tap the button below to see the latest gold signals 👇`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Active signals', url: `${APP_URL}?utm_source=telegram&utm_medium=pin&utm_campaign=introduce&utm_id=start` }],
          ],
        },
      },
    );
  }

  @Action('support')
  support(@Ctx() ctx: Context) {
    ctx.reply(`I'm a bot and can't provide live support!
But I can read your feedback and improve.
So if you have any feedback, just write it here`);
    this.setState(ctx.from.id, {
      state: UserStateType.Support,
    });
  }

  @Command('bank')
  onIban(@Ctx() ctx: Context) {
    ctx.reply(`Please enter your IBAN for rewards:`, {
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
          `${user.tag}\n${user.name}:\n\n${text}`,
        );
      }
    }
    await ctx.reply(
      'Your message was sent to the team. Thanks for your feedback.',
    );
    await ctx.sendChatAction('typing');
    this.welcome(ctx);
  }

  async setIban(ctx: Context) {
    const fromId = ctx.from.id;
    const user = await this.getUser(fromId);
    let iban: string = ctx.message['text'];
    iban = iban.replace('IR', '');
    iban = iban.replace('ir', '');
    iban = iban.replace('Ir', '');
    await ctx.sendChatAction('typing');
    if (iban.length !== 24) {
      ctx.reply(
        `Invalid IBAN. Please enter a valid 24-digit IBAN:`,
      );
    } else {
      await this.userModel.findByIdAndUpdate(user.id, { iban }).exec();
      ctx.reply('✅ Your IBAN has been saved');
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
    ctx.reply(`Please enter your search term\n/cancel`);
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
    ctx.reply(`Found ${count} user(s):`, {
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
    ctx.reply(`Please enter your message\n/cancel`);
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
    const replyTo = ctx.message['reply_to_message'];
    if (
      replyTo &&
      process.env.CONSULTING_ADMIN_IDS?.search(ctx.from.id.toString()) > -1
    ) {
      this.consultingBot.sendResponseMessage(ctx);
      return;
    }
    const userState = this.getState(ctx.from.id);
    switch (userState?.state) {
      case UserStateType.NewSignal:
        this.signalBot.handleNewSignalMessage(ctx);
        break;
      case UserStateType.Support:
        this.sendSupportMessage(ctx);
        break;
      case UserStateType.Consulting:
        this.consultingBot.sendUserMessage(ctx);
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
      case UserStateType.OunceAlarm:
        await this.ounceAlarmBot.handleTargetPrice(ctx);
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
      case 'consulting':
        this.consultingBot.onConsulting(ctx);
        break;
      case 'start':
        this.start(ctx);
        break;

      default:
        break;
    }
    ctx.answerCbQuery();
  }
}
