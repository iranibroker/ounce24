import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Signal,
  SignalStatus,
  SignalType,
  SignalTypeText,
  User,
} from '@ounce24/types';
import { Model } from 'mongoose';
import { Action, Command, Ctx, InjectBot, Update } from 'nestjs-telegraf';
import { Context, Telegraf, Telegram } from 'telegraf';
import { BaseBot, UserStateType } from './base-bot';
import { PersianNumberService } from '@ounce24/utils';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { PublishBotsService } from './publish-bots.service';
import { BOT_KEYS } from '../configs/publisher-bots.config';
import { UserStatsService } from './user-stats.service';

function getAvailableBot(signals: Signal[]) {
  let min: [number, string] = [10000, ''];
  for (const bot of BOT_KEYS) {
    const count = signals.filter(
      (s) => s.status === SignalStatus.Active && s.telegramBot === bot
    ).length;
    if (count === 0) return bot;
    if (count < min[0]) min = [count, bot];
  }
  return min[1];
}

@Injectable()
@Update()
export class SignalBotService extends BaseBot {
  constructor(
    @InjectBot('main') private bot: Telegraf<Context>,
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    @InjectModel(User.name) private userModel: Model<User>,
    private ouncePriceService: OuncePriceService,
    private publishService: PublishBotsService,
    private userStats: UserStatsService
  ) {
    super(userModel);

    this.ouncePriceService.obs.subscribe(async (price) => {
      if (!price) return;
      console.log('price', price);

      const signals = await this.signalModel
        .find({
          status: { $in: [SignalStatus.Active, SignalStatus.Pending] },
          deletedAt: null,
        })
        .populate('owner')
        .exec();

      for (const signal of signals) {
        let statusChangeDetection = false;
        if (signal.status === SignalStatus.Pending) {
          if (Signal.activeTrigger(signal, price)) {
            statusChangeDetection = true;
            if (signal.messageId)
              this.bot.telegram.deleteMessage(
                process.env.PUBLISH_CHANNEL_ID,
                signal.messageId
              );
            signal.status = SignalStatus.Active;
            signal.activeAt = new Date();
            signal.telegramBot = getAvailableBot(signals);
            signal.messageId = null;
            this.signalModel
              .findByIdAndUpdate(signal.id, {
                status: signal.status,
                activeAt: signal.activeAt,
                telegramBot: signal.telegramBot,
                messageId: null,
              })
              .exec();
          }
        } else {
          statusChangeDetection = true;
          if (!signal.telegramBot) {
            signal.telegramBot = getAvailableBot(signals);
            this.signalModel
              .findByIdAndUpdate(signal.id, {
                telegramBot: signal.telegramBot,
              })
              .exec();
          }
          if (price > signal.maxPrice || price < signal.minPrice) {
            if (signal.messageId)
              this.bot.telegram.deleteMessage(
                process.env.PUBLISH_CHANNEL_ID,
                signal.messageId
              );
            signal.status = SignalStatus.Closed;
            signal.closedAt = new Date();
            signal.closedOuncePrice = price;
            signal.messageId = null;
            this.signalModel
              .findByIdAndUpdate(signal.id, {
                status: signal.status,
                closedAt: signal.closedAt,
                messageId: null,
                closedOuncePrice: signal.closedOuncePrice,
              })
              .exec();
            this.userStats.updateUserSignals(signal.owner, signal);
          }
        }

        // check change detections and update message
        if (statusChangeDetection) {
          this.publishSignal(signal, price);
        }
      }
    });
  }

  @Command('new_signal')
  async newSignal(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    await ctx.reply('نوع سیگنال رو مشخص کنید', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: SignalTypeText[SignalType.Sell],
              callback_data: 'new_sell_signal',
            },
            {
              text: SignalTypeText[SignalType.Buy],
              callback_data: 'new_buy_signal',
            },
          ],
        ],
      },
    });
  }

  @Command('my_signals')
  async mySignals(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const user = await this.getUser(ctx.from.id);
    const signals = await this.signalModel
      .find({
        owner: user._id,
        status: { $in: [SignalStatus.Pending, SignalStatus.Active] },
        deletedAt: null,
      })
      .sort({ createdAt: 'desc' })
      .populate('owner')
      .exec();

    for (const signal of signals) {
      await ctx.reply(Signal.getMessage(signal, { showId: true }), {
        reply_markup: {
          inline_keyboard: [
            signal.status === SignalStatus.Active
              ? [
                  { text: 'بستن دستی', callback_data: 'close_signal' },
                  { text: 'ریسک فری', callback_data: 'risk_free' },
                ]
              : [{ text: 'حذف سیگنال', callback_data: 'remove_signal' }],
            // [{ text: 'publish', callback_data: 'publish_signal' }],
          ],
        },
      });
    }

    if (!signals.length) {
      ctx.reply('هیچ سیگنال کاشته شده یا فعالی ندارید.');
    }
  }

  @Command('my_closed_signals')
  async myClosedSignals(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const user = await this.getUser(ctx.from.id);
    const signals = await this.signalModel
      .find({
        owner: user._id,
        status: SignalStatus.Closed,
        deletedAt: null,
      })
      .sort({ createdAt: 'desc' })
      .populate('owner')
      .exec();

    const prevSignals = this.userStats.getUserSignals(user.id);

    for (const signal of signals) {
      await ctx.reply(
        Signal.getMessage(signal, { showId: true, signals: prevSignals })
      );
    }

    if (!signals.length) {
      ctx.reply('هیچ سیگنال بسته شده‌ای ندارید.');
    }
  }

  @Action('remove_signal')
  async removeSignal(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const message = ctx.callbackQuery.message;
    const text: string = ctx.callbackQuery.message['text'];
    const id = text.split('#')[1];
    await this.signalModel
      .findByIdAndUpdate(id, { deletedAt: new Date() })
      .exec();
    if (message.message_id) await ctx.deleteMessage(message.message_id);
    ctx.answerCbQuery('سیگنال شما حذف شد');
  }

  @Action('close_signal')
  async closeSignal(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const message = ctx.callbackQuery.message;
    const text: string = ctx.callbackQuery.message['text'];
    const id = text.split('#')[1];
    const signal = await this.signalModel.findById(id).populate('owner').exec();
    const updatedSignal = await this.signalModel
      .findByIdAndUpdate(
        id,
        {
          status: SignalStatus.Closed,
          messageId: null,
          closedAt: new Date(),
          closedOuncePrice: this.ouncePriceService.current,
        },
        { new: true }
      )
      .exec();

    updatedSignal.owner = signal.owner;

    if (message.message_id) await ctx.deleteMessage(message.message_id);

    if (signal.messageId) {
      this.publishService.addAction(signal.telegramBot, signal.id, (telegram) =>
        telegram.deleteMessage(process.env.PUBLISH_CHANNEL_ID, signal.messageId)
      );
    }

    this.publishSignal(updatedSignal);

    ctx.answerCbQuery('سیگنال بسته شد');
  }

  @Action('new_buy_signal')
  @Action('new_sell_signal')
  async newSellSignal(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const isSell = ctx.callbackQuery['data'] === 'new_sell_signal';
    const signal = {
      type: isSell ? SignalType.Sell : SignalType.Buy,
      createdOuncePrice: this.ouncePriceService.current,
    } as Signal;

    ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    try {
      await ctx
        .editMessageText(`ایجاد سیگنال ${SignalTypeText[signal.type]}:`)
        .catch(() => {
          //unhandled
        });
    } catch (error) {
      // unhandled
    }

    this.setState<Partial<Signal>>(ctx.from.id, {
      state: UserStateType.NewSignal,
      data: signal,
    });
    ctx.answerCbQuery();

    await ctx.reply(
      `قیمت ورود به معامله را وارد کنید: قیمت فعلی انس طلا ${this.ouncePriceService.current} است`
    );
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
          ctx.reply(
            `مقدار وارد شده باید حداقل یک واحد بزرگتر از قیمت ورود باشد.`
          );
          return;
        }
        signal.maxPrice = value;
        ctx.reply(`حد سود را مشخص کنید:`);
      } else if (!signal.minPrice) {
        if (signal.entryPrice - value < 1) {
          ctx.reply(
            `مقدار وارد شده باید حداقل یک واحد کوچکتر از قیمت ورود باشد.`
          );
          return;
        }
        if (value > signal.entryPrice - signal.maxPrice + signal.entryPrice) {
          ctx.reply(`مقدار حد سود نباید کمتر از حد ضرر باشد`);
          return;
        }
        signal.minPrice = value;
      }
    } else {
      if (!signal.minPrice) {
        if (signal.entryPrice - value < 1) {
          ctx.reply(
            `مقدار وارد شده باید حداقل یک واحد کوچکتر از قیمت ورود باشد.`
          );
          return;
        }
        signal.minPrice = value;
        ctx.reply(`حد سود را مشخص کنید:`);
      } else if (!signal.maxPrice) {
        if (value - signal.entryPrice < 1) {
          ctx.reply(
            `مقدار وارد شده باید حداقل یک واحد بزرگتر از قیمت ورود باشد.`
          );
          return;
        }
        if (value < signal.entryPrice - signal.minPrice + signal.entryPrice) {
          ctx.reply(`مقدار حد سود نباید کمتر از حد ضرر باشد`);
          return;
        }
        signal.maxPrice = value;
      }
    }

    if (signal.entryPrice && signal.maxPrice && signal.minPrice) {
      const user = await this.getUser(ctx.from.id);
      const dto = new this.signalModel({ ...signal, owner: user });
      const createdSignal = await dto.save();
      ctx.reply(Signal.getMessage(createdSignal));
      BaseBot.userStates.delete(ctx.from.id);

      if (process.env.PUBLISH_CHANNEL_ID) {
        const message = await this.bot.telegram.sendMessage(
          process.env.PUBLISH_CHANNEL_ID,
          Signal.getMessage(createdSignal)
        );

        this.signalModel
          .findByIdAndUpdate(signal.id, {
            messageId: message.message_id,
          })
          .exec();
      }
    }
  }

  @Action('follow_signal')
  async followSignal(@Ctx() ctx: Context) {
    // if (!(await this.isValid(ctx))) return;
    // const signal = await this.getSignalFromMessage(ctx);
    // if (signal) this.publishSignal(ctx, signal);
  }

  async publishSignal(signal: Signal, ouncePrice?: number) {
    const prevSignals = signal.owner
      ? this.userStats.getUserSignals(signal.owner.id)
      : undefined;

    const text = Signal.getMessage(signal, {
      showId: true,
      ouncePrice,
      signals: prevSignals,
    });
    let func: any;
    if (signal.messageId) {
      func = (telegram) => {
        telegram
          .editMessageText(
            process.env.PUBLISH_CHANNEL_ID,
            signal.messageId,
            '',
            text
          )
          .catch((er) => {
            console.error(er.response, signal.id);
          });
      };
    } else {
      func = (telegram) => {
        telegram
          .sendMessage(process.env.PUBLISH_CHANNEL_ID, text)
          .then((message) => {
            this.signalModel
              .findByIdAndUpdate(signal.id, {
                messageId: message.message_id,
              })
              .exec();
          })
          .catch((er) => {
            console.error(er.response, signal.id);
          });
      };
    }

    this.publishService.addAction(signal.telegramBot, signal.id, func);
  }

  getSignalFromMessage(@Ctx() ctx: Context) {
    const message = ctx.callbackQuery.message;
    const text: string = message['text'];
    const id = text.split('#')[1];
    return this.signalModel.findById(id).exec();
  }
}
