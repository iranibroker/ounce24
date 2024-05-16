import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Signal, SignalType, User } from '@ounce24/types';
import { Model } from 'mongoose';
import {
  Action,
  Command,
  Ctx,
  Hears,
  InjectBot,
  On,
  Start,
  Update,
} from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { BaseBot, UserStateType } from './base-bot';
import { PersianNumberService } from '@ounce24/utils';

@Injectable()
@Update()
export class BotService extends BaseBot {
  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    @InjectModel(User.name) private userModel: Model<User>
  ) {
    super(userModel);
  }

  @Start()
  start(@Ctx() ctx: Context) {
    this.welcome(ctx);
  }

  @Command('new_signal')
  async newSignal(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    await ctx.reply('نوع سیگنال رو مشخص کنید', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔴 فروش (sell)', callback_data: 'new_sell_signal' },
            { text: '🔵 خرید (buy)', callback_data: 'new_buy_signal' },
          ],
        ],
      },
    });
  }

  @Action('new_buy_signal')
  @Action('new_sell_signal')
  async newSellSignal(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const isSell = ctx.callbackQuery['data'] === 'new_sell_signal';
    ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.editMessageText(
      `ایجاد سیگنال ${isSell ? '🔴 فروش (sell)' : '🔵 خرید (buy)'}:`
    );

    this.setState<Partial<Signal>>(ctx.from.id, {
      state: UserStateType.NewSignal,
      data: { type: isSell ? SignalType.Sell : SignalType.Buy },
    });
    ctx.answerCbQuery();

    await ctx.reply('قیمت ورود به معامله را وارد کنید: مثلا 1934.95');
  }

  async handleNewSignalMessage(ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const signal = this.getStateData<Signal>(ctx.from.id);
    const isSell = signal.type === SignalType.Sell;
    const value = Number(PersianNumberService.toEnglish(ctx.message['text']));
    if (isNaN(Number(value))) {
      ctx.reply('لطفا یک مقدار عددی وارد کنید. مثلا: 3234.32');
      return;
    }

    if (!signal.entryPrice) {
      signal.entryPrice = value;
      ctx.reply(`حد ضرر را مشخص کنید:`);
      this.setStateData(ctx.from.id, signal);
    } else if (isSell) {
      if (!signal.maxPrice) {
        if (value - signal.entryPrice < 1) {
          ctx.reply(`مقدار وارد شده باید حداقل یک واحد بزرگتر از قیمت ورود باشد.`);
          return;
        }
        signal.maxPrice = value;
        ctx.reply(`حد سود را مشخص کنید:`);
      } else if (!signal.minPrice) {
        if (signal.entryPrice - value < 1) {
          ctx.reply(`مقدار وارد شده باید حداقل یک واحد کوچکتر از قیمت ورود باشد.`);
          return;
        }
        signal.minPrice = value;
      }
    } else {
      if (!signal.minPrice) {
        if (signal.entryPrice - value < 1) {
          ctx.reply(`مقدار وارد شده باید حداقل یک واحد کوچکتر از قیمت ورود باشد.`);
          return;
        }
        signal.minPrice = value;
        ctx.reply(`حد سود را مشخص کنید:`);
      } else if (!signal.maxPrice) {
        if (value - signal.entryPrice < 1) {
          ctx.reply(`مقدار وارد شده باید حداقل یک واحد بزرگتر از قیمت ورود باشد.`);
          return;
        }
        signal.maxPrice = value;
      }
    }

    if (signal.entryPrice && signal.maxPrice && signal.minPrice) {
      const user = await this.getUser(ctx.from.id);
      const createdData = new this.signalModel({ ...signal, owner: user._id });
      await createdData.save();
      ctx.reply(Signal.getMessage(signal));
      this.userStates.delete(ctx.from.id);
    }
  }

  @On('message')
  async onMessage(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const userState = this.getState(ctx.from.id);
    switch (userState?.state) {
      case UserStateType.NewSignal:
        this.handleNewSignalMessage(ctx);
        break;

      default:
        break;
    }
  }
}
