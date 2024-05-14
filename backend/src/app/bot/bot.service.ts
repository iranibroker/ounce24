import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Signal, SignalType } from '@ounce24/types';
import { Model } from 'mongoose';
import {
  Action,
  Command,
  Ctx,
  Hears,
  InjectBot,
  On,
  Update,
} from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';

enum UserStateType {
  NewSignal,
}

type UserState<T = any> = {
  state: UserStateType;
  data?: T;
};

@Injectable()
@Update()
export class BotService {
  private userStates = new Map<number, UserState>();

  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    @InjectModel(Signal.name) private signalModel: Model<Signal>
  ) {}

  setState<T>(userId: number, state: UserState<T>) {
    this.userStates.set(userId, state);
  }

  getState<T>(userId: number) {
    const state: UserState<T> = this.userStates.get(userId);
    return state;
  }

  setStateData<T>(userId: number, data: T) {
    const state = this.userStates.get(userId);
    if (state) {
      state.data = data;
      this.userStates.set(userId, state);
    }
  }

  getStateData<T>(userId: number) {
    const state: UserState<T> = this.userStates.get(userId);
    return state?.data;
  }

  @Command('new_signal')
  async newSignal(@Ctx() ctx: Context) {
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
    const isSell = ctx.callbackQuery['data'] === 'new_sell_signal';
    ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.editMessageText(`ایجاد سیگنال ${isSell ? '🔴 فروش (sell)' : '🔵 خرید (buy)'}:`);

    this.setState<Partial<Signal>>(ctx.from.id, {
      state: UserStateType.NewSignal,
      data: { type: isSell ? SignalType.Sell : SignalType.Buy },
    });
    ctx.answerCbQuery();

    await ctx.reply('قیمت ورود به معامله را وارد کنید: مثلا 1934.95');
  }

  async handleNewSignalMessage(ctx: Context) {
    const signal = this.getStateData<Signal>(ctx.from.id);
    const isSell = signal.type === SignalType.Sell;
    const text = ctx.message['text'];

    if (!signal.entryPrice) {
      signal.entryPrice = Number(text);
      ctx.reply(`حد ${isSell ? 'سود' : 'زیان'} را مشخص کنید:`);
      this.setStateData(ctx.from.id, signal);
    } else if (!signal.minPrice) {
      signal.minPrice = Number(text);
      ctx.reply(`حد ${isSell ? 'زیان' : 'سود'} را مشخص کنید:`);
      this.setStateData(ctx.from.id, signal);
    } else if (!signal.maxPrice) {
      signal.maxPrice = Number(text);
      const createdData = new this.signalModel(signal);
      await createdData.save();
      ctx.reply(Signal.getMessage(signal));
      this.userStates.delete(ctx.from.id);
    }
  }

  @On('message')
  onMessage(@Ctx() ctx: Context) {
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
