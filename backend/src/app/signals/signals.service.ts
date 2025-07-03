import {
  HttpException,
  HttpStatus,
  Injectable,
  NotAcceptableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  GemLog,
  GemLogAction,
  Signal,
  SignalStatus,
  SignalType,
  User,
} from '@ounce24/types';
import { Model } from 'mongoose';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { EVENTS } from '../consts';
import { Cron } from '@nestjs/schedule';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { CoreMessage, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

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
export class SignalsService {
  constructor(
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(GemLog.name) private gemLogModel: Model<GemLog>,
    private eventEmitter: EventEmitter2,
    private ouncePriceService: OuncePriceService,
  ) {}

  @OnEvent(EVENTS.OUNCE_PRICE_UPDATED)
  private async handleOuncePriceUpdated(price: number) {
    if (!price) return;

    const signals = await this.signalModel
      .find({
        status: { $in: [SignalStatus.Active, SignalStatus.Pending] },
        deletedAt: null,
      })
      .populate('owner')
      .exec();

    for (const signal of signals) {
      if (signal.status === SignalStatus.Pending) {
        if (Signal.activeTrigger(signal, price)) {
          signal.status = SignalStatus.Active;
          signal.activeAt = new Date();
          signal.save().then((savedSignal) => {
            this.eventEmitter.emit(EVENTS.SIGNAL_ACTIVE, savedSignal);
          });
        }
      } else {
        if (Signal.closeTrigger(signal, price)) {
          this.closeSignal(signal, price);
        }
      }
    }
  }

  async addSignal(signal: Signal) {
    console.log(signal);
    if (!signal.owner) return;
    const owner = await this.userModel.findById(signal.owner);
    const signals = await this.signalModel
      .find({
        owner,
        status: { $in: [SignalStatus.Pending, SignalStatus.Active] },
        deletedAt: null,
      })
      .exec();

    if (signals.length >= MAX_ACTIVE_SIGNAL) {
      throw new HttpException(
        `Maximum number of active signals (${MAX_ACTIVE_SIGNAL}) reached`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySignals = await this.signalModel
      .find({
        owner,
        createdAt: { $gte: today },
        deletedAt: null,
      })
      .exec();

    if (todaySignals.length >= MAX_DAILY_SIGNAL) {
      throw new HttpException(
        `Maximum number of daily signals (${MAX_DAILY_SIGNAL}) reached`,
        HttpStatus.REQUEST_TIMEOUT,
      );
    }

    const nearSignal = await this.signalModel
      .findOne({
        owner,
        type: signal.type,
        entryPrice: {
          $gte: signal.entryPrice - 4,
          $lte: signal.entryPrice + 4,
        },
        status: {
          $in: [SignalStatus.Active, SignalStatus.Pending],
        },
        deletedAt: null,
      })
      .exec();

    if (nearSignal) {
      throw new HttpException(
        `You have another active signal near this point. Please enter a different entry point:`,
        HttpStatus.CONFLICT,
      );
    }

    if (
      Math.abs(signal.entryPrice - signal.maxPrice) < 1 ||
      Math.abs(signal.entryPrice - signal.maxPrice) > 200 ||
      Math.abs(signal.entryPrice - signal.minPrice) < 1 ||
      Math.abs(signal.entryPrice - signal.minPrice) > 200
    ) {
      throw new HttpException('Invalid entry', HttpStatus.BAD_REQUEST);
    }

    signal.publishable = owner.totalScore >= MIN_SIGNAL_SCORE;

    const savedSignal = await this.signalModel.create(signal);
    this.eventEmitter.emit(EVENTS.SIGNAL_CREATED, savedSignal);
    return savedSignal;
  }

  async closeSignal(signal: Signal, price: number) {
    signal.status = SignalStatus.Closed;
    signal.closedAt = new Date();
    signal.closedOuncePrice = price;
    const savedSignal = await this.signalModel
      .findByIdAndUpdate(signal._id, signal, { new: true })
      .populate('owner')
      .exec();

    const gemPerScore = Number(process.env.GEM_PER_SCORE) || 10;
    const minScore = Number(process.env.MIN_SCORE_FOR_GEM) || 0;
    if (gemPerScore > 0) {
      if (savedSignal.score > minScore && savedSignal.score > gemPerScore) {
        const giftGems = Math.floor(savedSignal.score / gemPerScore);
        this.userModel
          .findByIdAndUpdate(savedSignal.owner._id, {
            $inc: { gem: giftGems },
          })
          .exec();

        this.gemLogModel.create({
          user: savedSignal.owner._id,
          gemsChange: giftGems,
          gemsBefore: savedSignal.owner.gem,
          gemsAfter: savedSignal.owner.gem + giftGems,
          action: GemLogAction.CloseSignal,
        });

        savedSignal.gem = giftGems;
        savedSignal.save();
      }
    }

    this.eventEmitter.emit(EVENTS.SIGNAL_CLOSED, savedSignal);
    return signal;
  }

  async removeSignal(signal: Signal) {
    if (signal.status !== SignalStatus.Pending) return;
    const savedSignal = await this.signalModel
      .findByIdAndUpdate(
        signal,
        { deletedAt: new Date(), status: SignalStatus.Canceled },
        { new: true },
      )
      .populate('owner')
      .exec();
    this.eventEmitter.emit(EVENTS.SIGNAL_CANCELED, savedSignal);
    return signal;
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
        await this.closeSignal(signal, this.ouncePriceService.current);
      } else if (signal.status === SignalStatus.Pending) {
        await this.removeSignal(signal);
      }
    }
  }

  async analyzeSignal(signal: Signal, user: User) {
    // Check if user has gems
    const currentUser = await this.userModel.findById(user.id).exec();
    if (!currentUser) {
      throw new NotAcceptableException('User not found');
    }

    if (!currentUser.gem || currentUser.gem <= 0) {
      throw new NotAcceptableException('Insufficient gems to analyze signal');
    }

    delete signal.owner;
    signal.createdOuncePrice = this.ouncePriceService.current;
    const messages: CoreMessage[] = [
      {
        role: 'system',
        content: `
          دریافت کنید و تحلیل کوتاه و محاوره‌ای برای خرید و فروش انس طلا براساس اطلاعات کاربر و تکمیلی از TradingView آماده کنید.

# مراحل

1. **دریافت قیمت لحظه‌ای از کاربر**: قیمتی که کاربر می‌دهد را دریافت کنید.
2. **جمع‌آوری اطلاعات از TradingView**: برای تکمیل تحلیل، داده‌های مرتبط به بازار انس طلا را از TradingView بخوانید.
3. **تحلیل بازار**: بر اساس اطلاعات دریافتی از تریدیتک ویو و داده‌های کاربر، بازار را تحلیل کن و روند رو به صعودی یا نزولی بودن در آینده رو هم در نظر بگیر. الگوها و روندهای مهم را شناسایی کنید.
4. **نتیجه‌گیری و پیش‌بینی**: بر اساس تحلیل‌ها، خلاصه‌ای از وضعیت بازار و پیش‌بینی‌های احتمالی خود را بیان کنید.
5. **بیان به زبان محاوره‌ای**: نتیجه‌گیری‌ها را به شکلی ساده و دوستانه بیان کنید.

# قالب خروجی

- پاراگراف  کوتاه و ساده
- با لحن محاوره‌ای و دوستانه به صورت پاراگراف
- اگه جایی امکان استفاده از اموجی رو داره در حد یکی دوتا استفاده کن
- قالب اعداد با حروف انگلیسی باشه و جداکننده داشته باشه

# اطلاعات تکمیلی
قیمت فعلی انس طلا: ${signal.createdOuncePrice}
`,
      },
      {
        role: 'user',
        content: `اینو آنالیز کن:
        
        ${JSON.stringify(signal)}
        `,
      },
    ];

    const result = await generateText({
      model: openai('gpt-4o'),
      messages,
    });

    // Deduct 1 gem from user
    await this.userModel
      .findByIdAndUpdate(user.id, {
        $inc: { gem: -1 },
      })
      .exec();

    this.gemLogModel.create({
      user: user.id,
      gemsChange: -1,
      gemsBefore: currentUser.gem,
      gemsAfter: currentUser.gem - 1,
      action: GemLogAction.SignalAnalyze,
    });

    return {
      analysis: result.text,
      signal: signal,
      currentPrice: signal.createdOuncePrice,
    };
  }
}
