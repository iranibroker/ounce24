import {
  HttpException,
  NotFoundException,
  HttpStatus,
  Injectable,
  NotAcceptableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  GemLog,
  GemLogAction,
  Signal,
  SignalAnalyze,
  SignalStatus,
  SignalType,
  User,
} from '@ounce24/types';
import { Model } from 'mongoose';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { EVENTS } from '../consts';
import { Cron } from '@nestjs/schedule';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { AiChatService } from '../ai-chat/ai-chat.service';

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
    private aiChatService: AiChatService,
    @InjectModel(SignalAnalyze.name)
    private signalAnalyzeModel: Model<SignalAnalyze>,
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
    signal.createdOuncePrice = this.ouncePriceService.current;
    signal.status = SignalStatus.Pending;
    if (!signal.owner) return;

    if (signal.maxPrice < signal.minPrice) {
      throw new HttpException(
        {
          translationKey: 'signal.invalidEntry',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

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
        {
          translationKey: 'signal.maxActive',
          data: MAX_ACTIVE_SIGNAL,
        },
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
        {
          translationKey: 'signal.maxDaily',
          data: MAX_DAILY_SIGNAL,
        },
        HttpStatus.REQUEST_TIMEOUT,
      );
    }

    if (signal.instantEntry) {
      signal.entryPrice = this.ouncePriceService.current;
      signal.status = SignalStatus.Active;
      signal.activeAt = new Date();
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
        {
          translationKey: 'signal.near',
        },
        HttpStatus.CONFLICT,
      );
    }

    if (
      Math.abs(signal.entryPrice - signal.maxPrice) < 1 ||
      Math.abs(signal.entryPrice - signal.maxPrice) > 200 ||
      Math.abs(signal.entryPrice - signal.minPrice) < 1 ||
      Math.abs(signal.entryPrice - signal.minPrice) > 200
    ) {
      throw new HttpException(
        {
          translationKey: 'signal.invalidEntry',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    signal.publishable =
      owner.alwaysPublish || owner.totalScore >= MIN_SIGNAL_SCORE;

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

    // const gemPerScore = Number(process.env.GEM_PER_SCORE) || 10;
    const minScore = Number(process.env.MIN_SCORE_FOR_GEM) || 0;
    if (savedSignal.score > minScore) {
      const giftGems = 1;
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

  async analyzeSignal(signal: Signal, userId?: string) {
    // Check if user has gems
    const user = await this.userModel.findById(userId || signal.owner._id).exec();
    if (!user) {
      throw new NotFoundException({
        translationKey: 'userNotFound',
      });
    }

    if (!user.gem || user.gem <= 0) {
      throw new NotAcceptableException({
        translationKey: 'insufficientGems',
      });
    }

    const currentPrice = this.ouncePriceService.current;
    const dto = {
      type: signal.type,
      entryPrice: signal.entryPrice,
      tp: signal.profit,
      sl: signal.loss,
    };

    const result = await this.aiChatService.createResponse(JSON.stringify(dto));

    // // Deduct 1 gem from user
    await this.userModel
      .findByIdAndUpdate(user.id, {
        $inc: { gem: -1 },
      })
      .exec();

    this.gemLogModel.create({
      user: user.id,
      gemsChange: -1,
      gemsBefore: user.gem,
      gemsAfter: user.gem - 1,
      action: GemLogAction.SignalAnalyze,
    });

    this.signalAnalyzeModel.create({
      signal: signal.id,
      ouncePrice: currentPrice,
      totalTokens: result.totalTokens,
      analyzeText: result.text,
      creator: user.id,
    });

    return {
      analysis: result.text,
      signal,
      user,
      currentPrice: currentPrice,
      totalTokens: result.totalTokens,
    };
  }
}
