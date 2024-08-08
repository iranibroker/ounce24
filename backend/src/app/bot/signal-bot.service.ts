import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Signal,
  SignalStatus,
  SignalType,
  SignalTypeText,
  User,
} from '@ounce24/types';
import { Model, Types } from 'mongoose';
import { Action, Command, Ctx, InjectBot, Update } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { BaseBot, UserStateType } from './base-bot';
import { PersianNumberService } from '@ounce24/utils';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { PublishBotsService } from './publish-bots.service';
import { BOT_KEYS } from '../configs/publisher-bots.config';
import { UserStatsService } from './user-stats.service';
import { AuthService } from '../auth/auth.service';
import { Cron } from '@nestjs/schedule';

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

const MAX_ACTIVE_SIGNAL = isNaN(Number(process.env.MAX_ACTIVE_SIGNAL))
  ? 3
  : Number(process.env.MAX_ACTIVE_SIGNAL);

const MAX_DAILY_SIGNAL = isNaN(Number(process.env.MAX_DAILY_SIGNAL))
  ? 5
  : Number(process.env.MAX_DAILY_SIGNAL);

const MIN_SIGNAL_SCORE = isNaN(Number(process.env.MIN_SIGNAL_SCORE))
  ? 20
  : Number(process.env.MIN_SIGNAL_SCORE);

@Injectable()
@Update()
export class SignalBotService extends BaseBot {
  constructor(
    @InjectBot('main') private bot: Telegraf<Context>,
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    @InjectModel(User.name) private userModel: Model<User>,
    private ouncePriceService: OuncePriceService,
    private publishService: PublishBotsService,
    private userStats: UserStatsService,
    private auth: AuthService
  ) {
    super(userModel, auth, bot);

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

            this.bot.telegram.sendMessage(
              signal.owner.telegramId,
              Signal.getMessage(signal, { showId: true })
            );
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
          if (Signal.closeTrigger(signal, price)) {
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
            await this.userStats.updateUserSignals(signal.owner, signal);
            this.bot.telegram.sendMessage(
              signal.owner.telegramId,
              Signal.getMessage(signal, { showId: true })
            );
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
    const user = await this.getUser(ctx.from.id);
    const signals = await this.signalModel
      .find({
        owner: user._id,
        status: { $in: [SignalStatus.Pending, SignalStatus.Active] },
        deletedAt: null,
      })
      .sort({ createdAt: 'asc' })
      .populate('owner')
      .exec();
    if (signals.length >= MAX_ACTIVE_SIGNAL) {
      ctx.reply(
        `سیگنال‌های فعال و کاشته شده شما نمی‌تواند بیشتر از ${MAX_ACTIVE_SIGNAL} عدد باشد. با استفاده از /my_signals سیگنال‌های خود را مدیریت کنید.`
      );
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySignals = await this.signalModel
      .find({
        owner: user._id,
        createdAt: { $gte: today },
        deletedAt: null,
      })
      .sort({ createdAt: 'asc' })
      .populate('owner')
      .exec();
    if (todaySignals.length >= MAX_DAILY_SIGNAL) {
      ctx.reply(
        `امکان کاشت بیشتر از ${MAX_ACTIVE_SIGNAL} سیگنال در روز وجود ندارد. با استفاده از /my_signals سیگنال‌های خود را مدیریت کنید.`
      );
      return;
    }

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
      .sort({ createdAt: 'asc' })
      .populate('owner')
      .exec();

    for (const signal of signals) {
      await ctx.reply(
        Signal.getMessage(signal, {
          showId: true,
          ouncePrice: this.ouncePriceService.current,
        }),
        {
          reply_markup: {
            inline_keyboard: [
              signal.status === SignalStatus.Active
                ? [
                    { text: 'refresh', callback_data: 'refresh_signal' },
                    { text: 'بستن دستی', callback_data: 'close_signal' },
                    { text: 'ریسک فری', callback_data: 'risk_free' },
                  ]
                : [{ text: 'حذف سیگنال', callback_data: 'remove_signal' }],
              // [{ text: 'publish', callback_data: 'publish_signal' }],
            ],
          },
        }
      );
    }

    if (!signals.length) {
      ctx.reply('هیچ سیگنال کاشته شده یا فعالی ندارید.');
    }
  }

  @Command('charts')
  charts(@Ctx() ctx: Context) {
    ctx.reply(`تایم فریم نمودار خود را انتخاب کنید:`, {
      reply_markup: {
        inline_keyboard: [
          [{text: 'یک دقیقه‌ای (1M)', url: `https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD&interval=1`}],
          [{text: '۵ دقیقه‌ای (5M)', url: `https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD&interval=5`}],
          [{text: '۱۵ دقیقه‌ای (15M)', url: `https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD&interval=15`}],
          [{text: 'یک ساعتی (1H)', url: `https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD&interval=60`}],
          [{text: 'چهار ساعتی (4H)', url: `https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD&interval=240`}],
        ]
      }
    })
  }

  @Command('update_all_user_signals')
  async update_all_user_signals(@Ctx() ctx: Context) {
    await this.userStats.updateAll();
    ctx.reply('done');
  }

  @Command('my_closed_signals')
  async myClosedSignals(
    @Ctx() ctx: Context,
    limit = 10,
    skip = 0,
    userId?: string
  ) {
    if (!(await this.isValid(ctx))) return;
    const user = await this.getUser(ctx.from.id);
    const signals = await this.signalModel
      .find({
        owner: userId ? new Types.ObjectId(userId) : user._id,
        status: SignalStatus.Closed,
        deletedAt: null,
      })
      .sort({ createdAt: 'desc' })
      .limit(limit)
      .skip(skip)
      .populate('owner')
      .exec();

    const totalCount = await this.signalModel
      .countDocuments({
        owner: userId ? new Types.ObjectId(userId) : user._id,
        status: SignalStatus.Closed,
        deletedAt: null,
      })
      .exec();

    for (const signal of signals) {
      await ctx.reply(Signal.getMessage(signal, { showId: true }));
    }
    if (totalCount > limit && !skip) {
      await ctx.reply(`تا بحال ${totalCount} سیگنال بسته شده داشته اید.`, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'مشاهده همه سیگنال های بسته شده',
                callback_data: userId
                  ? `user_closed_signals_all:::${userId}`
                  : 'my_closed_signals_all',
              },
            ],
          ],
        },
      });
    }

    if (!signals.length) {
      ctx.reply('هیچ سیگنال بسته شده‌ای ندارید.');
    }
  }

  @Action('my_closed_signals_all')
  async myClosedSignalsAll(@Ctx() ctx: Context) {
    this.myClosedSignals(ctx, 100, 10);
  }

  @Command('profile')
  async profile(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const user = await this.getUser(ctx.from.id);

    await this.userStats.updateUserSignals(user);
    const prevSignals = this.userStats.getUserSignals(user.id);

    await ctx.reply(`👤${user.title} (${user.name})`);
    if (prevSignals?.length) await ctx.reply(Signal.getStatsText(prevSignals));
  }

  @Command('leaderboard')
  async leaderboard(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const user = await this.getUser(ctx.from.id);

    await ctx.reply(
      await this.userStats.getLeaderBoardMessage({ userId: user.id })
    );
  }

  @Command('leaderboard_week')
  async leaderboardWeeks(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const user = await this.getUser(ctx.from.id);

    await ctx.reply(
      await this.userStats.getLeaderBoardMessage({
        userId: user.id,
        fromDate: this.getLastSundayAt21(),
      })
    );
  }

  @Command('leaderboard_admin_prev_week')
  async leaderboardPrevWeeksAdmin(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const fromDate = this.getPrevSundayAt21();
    const toDate = this.getLastSundayAt21();

    const leaderboard = await this.userStats.getLeaderBoard(fromDate, toDate);
    for (let i = 0; i < 3; i++) {
      const user = leaderboard[i];
      const signals = this.userStats.getUserSignals(user.id, fromDate, toDate);
      const sumPip = signals.reduce((sum, signal) => {
        return sum + signal.pip;
      }, 0);
      await ctx.reply(`${i + 1}: ${user.name} (${user.title})
${Signal.getStatsText(signals)}
برآیند: ${sumPip}
`);
    }
  }

  @Command('leaderboard_admin_this_week')
  async leaderboardThisWeeksAdmin(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const fromDate = this.getLastSundayAt21();
    const toDate = new Date();

    const leaderboard = await this.userStats.getLeaderBoard(fromDate, toDate);
    for (let i = 0; i < 3; i++) {
      const user = leaderboard[i];
      const signals = this.userStats.getUserSignals(user.id, fromDate, toDate);
      const sumPip = signals.reduce((sum, signal) => {
        return sum + signal.pip;
      }, 0);
      await ctx.reply(`${i + 1}: ${user.name} (${user.title})
${Signal.getStatsText(signals)}
برآیند: ${sumPip}
`);
    }
  }

  @Action('refresh_signal')
  async refreshSignal(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const message = ctx.callbackQuery.message;
    const text: string = message['text'];
    const id = text.split('^^')[1];
    const signal = await this.signalModel.findById(id).populate('owner').exec();

    await this.refreshBotSignal(ctx, signal, message.message_id);

    ctx.answerCbQuery();
  }

  @Action('remove_signal')
  async removeSignal(@Ctx() ctx?: Context, signalId?: string) {
    if (ctx && !(await this.isValid(ctx))) return;
    const message = ctx?.callbackQuery.message;
    const text: string = ctx?.callbackQuery.message['text'];
    const id = text?.split('^^')[1] || signalId;
    const signal = await this.signalModel.findById(id).exec();
    if (signal.status !== SignalStatus.Pending) return;
    const updatedSignal = await this.signalModel
      .findByIdAndUpdate(
        id,
        { deletedAt: new Date(), status: SignalStatus.Canceled },
        { new: true }
      )
      .populate('owner')
      .exec();
    if (ctx && message?.message_id) await ctx.deleteMessage(message.message_id);
    if (updatedSignal.messageId) {
      this.bot.telegram.deleteMessage(
        process.env.PUBLISH_CHANNEL_ID,
        updatedSignal.messageId
      );
    }

    this.bot.telegram.sendMessage(
      updatedSignal.owner.telegramId,
      Signal.getMessage(updatedSignal, { showId: true })
    );

    if (ctx) ctx.answerCbQuery('سیگنال شما حذف شد');
  }

  @Action('close_signal')
  async closeSignal(@Ctx() ctx?: Context, signalId?: string) {
    if (ctx && !(await this.isValid(ctx))) return;
    const message = ctx?.callbackQuery.message;
    const text: string = ctx?.callbackQuery.message['text'];
    const id = text?.split('^^')[1] || signalId;
    const signal = await this.signalModel.findById(id).populate('owner').exec();
    if (signal.status !== SignalStatus.Active) return;
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
      .populate('owner')
      .exec();

    updatedSignal.owner = signal.owner;

    if (ctx && message?.message_id) await ctx.deleteMessage(message.message_id);

    if (signal.messageId) {
      this.publishService.addAction(
        signal.telegramBot,
        signal.id,
        (telegram) =>
          telegram.deleteMessage(
            process.env.PUBLISH_CHANNEL_ID,
            signal.messageId
          ),
        true
      );
    }

    await this.userStats.updateUserSignals(signal.owner);

    this.publishSignal(updatedSignal);

    if (ctx) {
      ctx.answerCbQuery('سیگنال بسته شد');
      ctx.reply(Signal.getMessage(updatedSignal, { showId: true }));
    } else {
      this.bot.telegram.sendMessage(
        signal.owner.telegramId,
        Signal.getMessage(updatedSignal, { showId: true })
      );
    }
  }

  @Action('risk_free')
  async riskFree(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const message = ctx.callbackQuery.message;
    const text: string = message['text'];
    const id = text.split('^^')[1];
    const signal = await this.signalModel.findById(id).populate('owner').exec();
    if (Signal.getActivePip(signal, this.ouncePriceService.current) < 0) {
      ctx.answerCbQuery('امکان ریسک فری سیگنال منفی نیست');
      return;
    }

    if (signal.status !== SignalStatus.Active) return;

    const updatedSignal = await this.signalModel
      .findByIdAndUpdate(
        id,
        {
          riskFree: true,
        },
        { new: true }
      )
      .exec();

    this.refreshBotSignal(ctx, updatedSignal, message.message_id);
    ctx.answerCbQuery('سیگنال ریسک فری شد');
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
        if (value - signal.entryPrice < 1 || value - signal.entryPrice > 200) {
          ctx.reply(
            `مقدار وارد شده باید بین ۱ تا ۲۰۰ دلار بیشتر از قیمت ورود باشد.`
          );
          return;
        }
        signal.maxPrice = value;
        ctx.reply(`حد سود را مشخص کنید:`);
      } else if (!signal.minPrice) {
        if (signal.entryPrice - value < 1 || signal.entryPrice - value > 200) {
          ctx.reply(
            `مقدار وارد شده باید ۱ تا ۲۰۰ دلار کوچکتر از قیمت ورود باشد.`
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
        if (signal.entryPrice - value < 1 || signal.entryPrice - value > 200) {
          ctx.reply(
            `مقدار وارد شده باید ۱ تا ۲۰۰ دلار کوچکتر از قیمت ورود باشد.`
          );
          return;
        }
        signal.minPrice = value;
        ctx.reply(`حد سود را مشخص کنید:`);
      } else if (!signal.maxPrice) {
        if (value - signal.entryPrice < 1 || value - signal.entryPrice > 200) {
          ctx.reply(
            `مقدار وارد شده باید بین ۱ تا ۲۰۰ دلار بیشتر از قیمت ورود باشد.`
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
      const userScore = this.userStats.getUserScore(user.id);
      const dto = new this.signalModel({
        ...signal,
        owner: user,
        publishable: userScore >= MIN_SIGNAL_SCORE,
      });
      const createdSignal = await dto.save();
      await ctx.reply(Signal.getMessage(createdSignal));
      BaseBot.userStates.delete(ctx.from.id);

      const prevSignals = this.userStats.getUserSignals(user.id);

      if (process.env.PUBLISH_CHANNEL_ID) {
        if (!createdSignal.publishable) {
          ctx.reply(
            `سیگنال شما با موفقیت ثبت شد اما در کانال منتشر نشد. حداقل امتیاز برای ارسال پیام در کانال ${MIN_SIGNAL_SCORE} امتیاز است. امتیاز فعلی شما ${userScore.toFixed(
              2
            )} امتیاز است.\nبا ثبت سیگنال‌های صحیح در ربات و دریافت امتیاز بیشتر، سیگنال‌های شما به صورت خودکار در کانال منتشر می‌شود.\nبرای مشاهده امتیاز سیگنال‌های قبلی خود، از /my_closed_signals\nو برای مدیریت سیگنال‌های کاشته شده از /my_signals استفاده کنید.`
          );
          return;
        }

        const message = await this.bot.telegram.sendMessage(
          process.env.PUBLISH_CHANNEL_ID,
          Signal.getMessage(createdSignal, {
            signals: prevSignals,
          })
        );
        this.signalModel
          .findByIdAndUpdate(createdSignal.id, {
            messageId: message.message_id,
          })
          .exec();
      }
    }
  }

  @Command('reset_all_profile')
  async resetAllProfile(@Ctx() ctx: Context) {
    const user = await this.getUser(ctx.from.id);
    const lastResetDiff = Math.floor(
      (Date.now() - new Date(user.resetAt).valueOf()) / 3600000 / 24
    );
    const isLessThan15 = user.resetAt && lastResetDiff <= 15;
    ctx.reply(
      `⚠️با تایید این گزینه تمام امتیازات گذشتت همراه تاریخچه سیگنال هات پاک میشه.
و میتونی از صفر به عنوان کاربر جدید شروع به کار کنی.

در هر 15 روز یکبار ازین فرصت میتونی استفاده کنی. ${
        isLessThan15 ? `شما به تازگی حساب خود را ریست کرده اید` : ''
      }.`,
      {
        reply_markup: {
          inline_keyboard: [
            isLessThan15
              ? []
              : [
                  {
                    text: 'تایید و حذف',
                    callback_data: 'accept_reset_all_profile',
                  },
                  { text: 'انصراف', callback_data: 'cancel_reset_all_profile' },
                ],
          ],
        },
      }
    );
  }

  @Action('accept_reset_all_profile')
  async acceptResetAllProfile(@Ctx() ctx: Context) {
    const user = await this.getUser(ctx.from.id);
    const isLessThan15 =
      user.resetAt &&
      Date.now() - new Date(user.resetAt).valueOf() < 3600000 * 24 * 15;
    if (isLessThan15) return;
    await this.signalModel.updateMany(
      { owner: user._id, deletedAt: null },
      { deletedAt: new Date() }
    );
    await this.userModel.findByIdAndUpdate(user.id, { resetAt: new Date() });
    const message = ctx.callbackQuery.message;
    ctx.deleteMessage(message.message_id);
    await ctx.answerCbQuery('امتیاز شما صفر و سیگنال‌های شما پاک شد.');
    this.welcome(ctx);
  }

  @Action('cancel_reset_all_profile')
  async cancelResetAllProfile(@Ctx() ctx: Context) {
    const message = ctx.callbackQuery.message;
    ctx.answerCbQuery();
    ctx.deleteMessage(message.message_id);
    this.welcome(ctx);
  }

  async refreshBotSignal(ctx: Context, signal: Signal, messageId: number) {
    try {
      await ctx.telegram.editMessageText(
        ctx.from.id,
        messageId,
        undefined,
        Signal.getMessage(signal, {
          showId: true,
          ouncePrice: this.ouncePriceService.current,
        }),
        {
          reply_markup: {
            inline_keyboard: [
              signal.status === SignalStatus.Active
                ? [
                    { text: 'refresh', callback_data: 'refresh_signal' },
                    { text: 'بستن دستی', callback_data: 'close_signal' },
                    { text: 'ریسک فری', callback_data: 'risk_free' },
                  ]
                : [{ text: 'حذف سیگنال', callback_data: 'remove_signal' }],
              // [{ text: 'publish', callback_data: 'publish_signal' }],
            ],
          },
        }
      );
    } catch (error) {
      // no need
    }
  }

  async publishSignal(signal: Signal, ouncePrice?: number) {
    if (!signal.publishable) return;
    const prevSignals = signal.owner
      ? this.userStats.getUserSignals(signal.owner.id)
      : undefined;

    const text = Signal.getMessage(signal, {
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
            console.error('error editing signal', er.response, signal.id);
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
            console.error('error sending signal', er.response, signal.id);
          });
      };
    }

    this.publishService.addAction(signal.telegramBot, signal.id, func);
  }

  getSignalFromMessage(@Ctx() ctx: Context) {
    const message = ctx.callbackQuery.message;
    const text: string = message['text'];
    const id = text.split('^^')[1];
    return this.signalModel.findById(id).exec();
  }

  @Cron('0 15 0 * * 6', {
    timeZone: 'UTC',
  })
  async resetSignals() {
    const signals = await this.signalModel
      .find({
        status: { $in: [SignalStatus.Active, SignalStatus.Pending] },
        deletedAt: null,
      })
      .populate('owner')
      .exec();

    for (const signal of signals) {
      if (signal.status === SignalStatus.Active) {
        await this.closeSignal(undefined, signal.id);
      } else if (signal.status === SignalStatus.Pending) {
        await this.removeSignal(undefined, signal.id);
      }
    }
  }
}
