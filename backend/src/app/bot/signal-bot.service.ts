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

@Injectable()
@Update()
export class SignalBotService extends BaseBot {
  constructor(
    @InjectBot('main') private bot: Telegraf<Context>,
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    @InjectModel(User.name) private userModel: Model<User>,
    private ouncePriceService: OuncePriceService,
    private publishService: PublishBotsService
  ) {
    super(userModel);

    this.ouncePriceService.obs.subscribe(async (price) => {
      if (!price) return;

      const signals = await this.signalModel
        .find({
          status: { $in: [SignalStatus.Active, SignalStatus.Pending] },
          deletedAt: null,
        })
        .exec();

      for (const signal of signals) {
        let statusChangeDetection = false;
        if (signal.status === SignalStatus.Pending) {
          if (Signal.activeTrigger(signal, price)) {
            statusChangeDetection = true;
            signal.status = SignalStatus.Active;
            this.signalModel
              .findByIdAndUpdate(signal.id, {
                status: signal.status,
              })
              .exec();
          }
        } else {
          statusChangeDetection = true;
          if (price > signal.maxPrice || price < signal.minPrice) {
            signal.status = SignalStatus.Closed;
            signal.closedAt = new Date();
            signal.closedOuncePrice = price;
            this.signalModel
              .findByIdAndUpdate(signal.id, {
                status: signal.status,
                closedAt: signal.closedAt,
                closedOuncePrice: signal.closedOuncePrice,
              })
              .exec();
          }
        }

        // check change detections and update message
        if (signal.messageId) {
          if (statusChangeDetection) {
            const func = (telegram) => {
              telegram
                .editMessageText(
                  process.env.PUBLISH_CHANNEL_ID,
                  signal.messageId,
                  '',
                  Signal.getMessage(signal, false, price)
                )
                .catch((er) => {
                  console.error(er.response);
                });
            };

            this.publishService.addAction(signal.id, func);
          }
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
        status: { $in: [SignalStatus.Active, SignalStatus.Pending] },
        deletedAt: null,
      })
      .sort({ createdAt: 'desc' })
      .exec();

    for (const signal of signals) {
      await ctx.reply(Signal.getMessage(signal, true), {
        reply_markup: {
          inline_keyboard: [
            signal.status === SignalStatus.Active
              ? [{ text: 'بستن دستی', callback_data: 'close_signal' }]
              : [{ text: 'حذف سیگنال', callback_data: 'remove_signal' }],
            [{ text: 'publish', callback_data: 'publish_signal' }],
          ],
        },
      });
    }

    if (!signals.length) {
      ctx.reply('هیچ سیگنال کاشته شده یا فعالی ندارید.');
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
    await this.signalModel
      .findByIdAndUpdate(id, { status: SignalStatus.Closed })
      .exec();

    if (message.message_id) await ctx.deleteMessage(message.message_id);
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
        signal.maxPrice = value;
      }
    }

    if (signal.entryPrice && signal.maxPrice && signal.minPrice) {
      const user = await this.getUser(ctx.from.id);
      const dto = new this.signalModel({ ...signal, owner: user._id });
      const createdSignal = await dto.save();
      ctx.reply(Signal.getMessage(createdSignal));
      BaseBot.userStates.delete(ctx.from.id);
      this.publishSignal(ctx, createdSignal);
    }
  }

  @Action('follow_signal')
  async followSignal(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const signal = await this.getSignalFromMessage(ctx);
    if (signal) this.publishSignal(ctx, signal);
  }

  @Action('publish_signal')
  async publishSignalAction(ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const signal = await this.getSignalFromMessage(ctx);
    if (signal) this.publishSignal(ctx, signal);
  }
  async publishSignal(ctx: Context, signal: Signal) {
    if (process.env.PUBLISH_CHANNEL_ID) {
      const message = await this.bot.telegram.sendMessage(
        process.env.PUBLISH_CHANNEL_ID,
        Signal.getMessage(signal),
        {
          reply_markup: {
            inline_keyboard: [[{ text: 'sample', callback_data: 'abcd' }]],
          },
        }
      );

      this.signalModel
        .findByIdAndUpdate(signal.id, {
          messageId: message.message_id,
        })
        .exec();
    }
  }

  getSignalFromMessage(@Ctx() ctx: Context) {
    const message = ctx.callbackQuery.message;
    const text: string = message['text'];
    const id = text.split('#')[1];
    return this.signalModel.findById(id).exec();
  }
}
