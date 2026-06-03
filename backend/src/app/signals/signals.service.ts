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
  OuncePriceCandle,
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
    @InjectModel(OuncePriceCandle.name)
    private candleModel: Model<OuncePriceCandle>,
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
      owner.alwaysPublish ||
      owner.totalScore >= MIN_SIGNAL_SCORE ||
      owner.weekScore >= MIN_SIGNAL_SCORE;

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
    const user = await this.userModel
      .findById(userId || signal.owner._id)
      .exec();
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

    // Fetch recent 5m candles from the past 3 days
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const candles5m = await this.candleModel.find({
      timestamp: { $gte: threeDaysAgo }
    }).sort({ timestamp: 1 }).exec();

    // Prepare default values
    let formattedHistory1h = 'No historical data available.';
    let formattedHistory15m = 'No historical data available.';
    let formattedHistory5m = 'No historical data available.';
    let rsi5m = 50;
    let rsi15m = 50;
    let rsi1h = 50;
    let sma20_5m = currentPrice;
    let atr5m = 1.5;

    if (candles5m.length > 0) {
      const closes5m = candles5m.map(c => c.close);
      rsi5m = calculateRSI(closes5m, 14);
      sma20_5m = calculateSMA(closes5m, 20);
      atr5m = calculateATR(candles5m, 14);

      const candles15m = aggregateTo15m(candles5m);
      const closes15m = candles15m.map(c => c.close);
      rsi15m = calculateRSI(closes15m, 14);

      const candles1h = aggregateTo1h(candles5m);
      const closes1h = candles1h.map(c => c.close);
      rsi1h = calculateRSI(closes1h, 14);

      const formatCandle = (c: any) => {
        const dateStr = new Date(c.timestamp).toISOString().replace('T', ' ').substring(5, 16);
        return `${dateStr},${c.open.toFixed(2)},${c.high.toFixed(2)},${c.low.toFixed(2)},${c.close.toFixed(2)}`;
      };

      if (candles1h.length > 0) {
        formattedHistory1h = candles1h.map(formatCandle).join('\n');
      }
      if (candles15m.length > 0) {
        formattedHistory15m = candles15m.slice(-48).map(formatCandle).join('\n'); // last 12 hours
      }
      formattedHistory5m = candles5m.slice(-24).map(formatCandle).join('\n'); // last 2 hours
    }

    const promptMessage = `
You are an expert, bold, and completely honest financial analyst AI for Ounce24.
Analyze the following short-term Gold (XAUUSD) signal based on the technical price history and indicators provided below.

Signal Details:
- Action Type: ${signal.type === SignalType.Buy ? 'BUY' : 'SELL'}
- Current Price: $${currentPrice.toFixed(2)}
- Entry Price: $${signal.entryPrice.toFixed(2)}
- Take Profit (TP): $${signal.profit.toFixed(2)} (Target Move: $${Math.abs(signal.profit - signal.entryPrice).toFixed(2)})
- Stop Loss (SL): $${signal.loss.toFixed(2)} (Risk Move: $${Math.abs(signal.loss - signal.entryPrice).toFixed(2)})

Technical Indicators (Calculated on 5m, 15m, 1h tables):
- 5m RSI(14): ${rsi5m.toFixed(2)}
- 15m RSI(14): ${rsi15m.toFixed(2)}
- 1h RSI(14): ${rsi1h.toFixed(2)}
- 5m SMA(20): $${sma20_5m.toFixed(2)} (Current price is ${currentPrice > sma20_5m ? 'above' : 'below'} SMA20 by $${Math.abs(currentPrice - sma20_5m).toFixed(2)})
- 5m ATR(14) (Volatility): $${atr5m.toFixed(2)}

Recent Price History (1-hour resolution, past 3 days - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory1h}

Recent Price History (15-minute resolution, past 12 hours - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory15m}

Recent Price History (5-minute resolution, past 2 hours - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory5m}

Instructions for Analysis:
1. Write the analysis strictly in Persian (Farsi).
2. Keep it simple, clear, and easy to understand for everyday traders (do not use overly complex or academic jargon).
3. Focus on exactly 1 or 2 technical analysis approaches (specifically Price Action / Support & Resistance levels, and RSI momentum). Do not analyze it from many conflicting angles.
4. Be bold, direct, and completely honest. Do not give false optimism or generic flatteries. If the signal is highly risky, illogical, or likely to result in a loss (e.g. SL is too tight, TP is unrealistic, or trading against a strong 5m/15m trend), say it clearly and warn the trader. If it is logical and aligned with the current market structure, confirm it simply.
5. Use clean HTML tags for styling (e.g. <b>, <ul>, <li>) if needed, but do not use markdown links. Return the HTML directly without any surrounding markdown code blocks (do not wrap in \`\`\`html or similar).
`;

    const result = await this.aiChatService.createResponse(promptMessage);

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

// Utility functions for technical analysis calculations

function calculateRSI(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;
  const sum = closes.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateATR(candles: { high: number; low: number; close: number }[], period = 14): number {
  if (candles.length < period + 1) return 1.5;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    trs.push(tr);
  }
  const sum = trs.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function aggregateTo15m(candles5m: OuncePriceCandle[]): { timestamp: Date; open: number; high: number; low: number; close: number }[] {
  const candles15m: { timestamp: Date; open: number; high: number; low: number; close: number }[] = [];
  const groups: { [key: string]: OuncePriceCandle[] } = {};

  for (const candle of candles5m) {
    const date = new Date(candle.timestamp);
    const minutes = date.getMinutes();
    const alignedMinutes = Math.floor(minutes / 15) * 15;
    date.setMinutes(alignedMinutes, 0, 0);
    const key = date.getTime().toString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(candle);
  }

  for (const key of Object.keys(groups).sort()) {
    const group = groups[key];
    const sortedGroup = [...group].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const timestamp = new Date(Number(key));
    const open = sortedGroup[0].open;
    const close = sortedGroup[sortedGroup.length - 1].close;
    const high = Math.max(...sortedGroup.map(c => c.high));
    const low = Math.min(...sortedGroup.map(c => c.low));

    candles15m.push({ timestamp, open, high, low, close });
  }
  return candles15m;
}

function aggregateTo1h(candles5m: OuncePriceCandle[]): { timestamp: Date; open: number; high: number; low: number; close: number }[] {
  const candles1h: { timestamp: Date; open: number; high: number; low: number; close: number }[] = [];
  const groups: { [key: string]: OuncePriceCandle[] } = {};

  for (const candle of candles5m) {
    const date = new Date(candle.timestamp);
    date.setMinutes(0, 0, 0);
    const key = date.getTime().toString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(candle);
  }

  for (const key of Object.keys(groups).sort()) {
    const group = groups[key];
    const sortedGroup = [...group].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const timestamp = new Date(Number(key));
    const open = sortedGroup[0].open;
    const close = sortedGroup[sortedGroup.length - 1].close;
    const high = Math.max(...sortedGroup.map(c => c.high));
    const low = Math.min(...sortedGroup.map(c => c.low));

    candles1h.push({ timestamp, open, high, low, close });
  }
  return candles1h;
}
