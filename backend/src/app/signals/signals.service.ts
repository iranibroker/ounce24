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
  SignalSubscription,
  TradingStyle,
  RiskTolerance,
} from '@ounce24/types';
import { Model } from 'mongoose';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { EVENTS } from '../consts';
import { Cron } from '@nestjs/schedule';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { AiOrchestratorService } from '../ai/ai-orchestrator.service';
import { analyzeMarketState, detectTradingStyle, buildMarketContextJson } from './market-analyzer.helper';
import axios from 'axios';

interface EconomicEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
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

const AI_GENERATION_THRESHOLD = isNaN(Number(process.env.AI_GENERATION_THRESHOLD))
  ? 75
  : Number(process.env.AI_GENERATION_THRESHOLD);

function parseLLMJson(text: string): any {
  let cleanText = text.trim();
  
  // Extract JSON substring from first '{' to last '}'
  const start = cleanText.indexOf('{');
  const end = cleanText.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleanText = cleanText.substring(start, end + 1);
  } else {
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }
  }

  // Escape any raw unescaped newlines inside double quotes
  let insideString = false;
  let escapedText = '';
  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    if (char === '"' && (i === 0 || cleanText[i - 1] !== '\\')) {
      insideString = !insideString;
      escapedText += char;
    } else if (char === '\n' && insideString) {
      escapedText += '\\n';
    } else if (char === '\r' && insideString) {
      escapedText += '\\r';
    } else {
      escapedText += char;
    }
  }

  return JSON.parse(escapedText);
}


@Injectable()
export class SignalsService {
  private priceCache = new Map<string, { price: number; timestamp: number }>();
  private indexCache = new Map<string, { price: number; changePercent: number; timestamp: number }>();
  private calendarCache: EconomicEvent[] = [];
  private lastCalendarFetch = 0;

  constructor(
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(GemLog.name) private gemLogModel: Model<GemLog>,
    @InjectModel(SignalSubscription.name)
    private signalSubModel: Model<SignalSubscription>,
    private eventEmitter: EventEmitter2,
    private ouncePriceService: OuncePriceService,
    private aiOrchestratorService: AiOrchestratorService,
    @InjectModel(SignalAnalyze.name)
    private signalAnalyzeModel: Model<SignalAnalyze>,
    @InjectModel(OuncePriceCandle.name)
    private candleModel: Model<OuncePriceCandle>,
  ) {}

  private async fetchYahooPrice(symbol: string): Promise<number | null> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 5000,
      });
      const price = response.data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      return price || null;
    } catch (error: any) {
      console.error(`Failed to fetch Yahoo Finance price for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getCachedYahooPrice(symbol: string): Promise<number | null> {
    const cached = this.priceCache.get(symbol);
    const now = Date.now();
    if (cached && (now - cached.timestamp < 10 * 60 * 1000)) {
      return cached.price;
    }
    const price = await this.fetchYahooPrice(symbol);
    if (price !== null) {
      this.priceCache.set(symbol, { price, timestamp: now });
      return price;
    }
    return cached ? cached.price : null;
  }

  private async fetchYahooPriceAndChange(symbol: string): Promise<{ price: number; changePercent: number } | null> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 5000,
      });
      const price = response.data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      const prevClose = response.data?.chart?.result?.[0]?.meta?.chartPreviousClose;
      if (price !== undefined && price !== null && prevClose) {
        const changePercent = ((price - prevClose) / prevClose) * 100;
        return {
          price: Number(price.toFixed(3)),
          changePercent: Number(changePercent.toFixed(2))
        };
      }
      return null;
    } catch (error: any) {
      console.error(`Failed to fetch Yahoo Price and Change for ${symbol}: ${error.message}`);
      return null;
    }
  }

  async getCachedYahooPriceAndChange(symbol: string): Promise<{ price: number; changePercent: number } | null> {
    const cached = this.indexCache.get(symbol);
    const now = Date.now();
    if (cached && (now - cached.timestamp < 10 * 60 * 1000)) {
      return { price: cached.price, changePercent: cached.changePercent };
    }
    const data = await this.fetchYahooPriceAndChange(symbol);
    if (data !== null) {
      this.indexCache.set(symbol, { ...data, timestamp: now });
      return data;
    }
    return cached ? { price: cached.price, changePercent: cached.changePercent } : null;
  }

  async fetchEconomicCalendar(): Promise<EconomicEvent[]> {
    const now = Date.now();
    if (this.calendarCache.length > 0 && (now - this.lastCalendarFetch < 2 * 60 * 60 * 1000)) {
      return this.calendarCache;
    }
    try {
      const response = await axios.get<EconomicEvent[]>('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
        timeout: 5000,
      });
      if (Array.isArray(response.data)) {
        this.calendarCache = response.data;
        this.lastCalendarFetch = now;
        return this.calendarCache;
      }
    } catch (error: any) {
      console.error(`Failed to fetch economic calendar: ${error.message}`);
    }
    return this.calendarCache;
  }

  async isNearHighImpactUSDNews(): Promise<{ near: boolean; eventName?: string; timeDiffMinutes?: number }> {
    try {
      const events = await this.fetchEconomicCalendar();
      const now = new Date();
      for (const event of events) {
        if (event.country === 'USD' && event.impact === 'High') {
          const eventDate = new Date(event.date);
          const diffMs = Math.abs(eventDate.getTime() - now.getTime());
          const diffMinutes = diffMs / (60 * 1000);
          if (diffMinutes <= 30) {
            return {
              near: true,
              eventName: event.title,
              timeDiffMinutes: Math.round(diffMinutes),
            };
          }
        }
      }
    } catch (error: any) {
      console.error(`Error checking high impact news: ${error.message}`);
    }
    return { near: false };
  }



  async addSignal(signal: Signal) {
    signal.createdOuncePrice = this.ouncePriceService.current;
    signal.status = SignalStatus.Pending;
    signal.market_context = this.ouncePriceService.isMarketOpen() ? 'OPEN' : 'CLOSED';
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


    const signalCount = await this.signalModel.countDocuments({
      owner: owner._id,
      deletedAt: null,
    });
    const isFirstSignal = signalCount === 0;

    const savedSignal = await this.signalModel.create(signal);
    await this.signalSubModel.create({
      signal: savedSignal._id,
      user: owner._id,
      followStatus: true,
      aiShield: false,
    });

    let isFirstSignalReward = false;
    if (!owner.firstSignalRewardClaimed && isFirstSignal) {
      isFirstSignalReward = true;
      const currentGems = owner.gem || 0;
      await this.userModel.findByIdAndUpdate(owner._id, {
        $inc: { gem: 10 },
        $set: { firstSignalRewardClaimed: true }
      }).exec();

      await this.gemLogModel.create({
        user: owner._id,
        gemsChange: 10,
        gemsBefore: currentGems,
        gemsAfter: currentGems + 10,
        action: GemLogAction.FirstSignalReward,
      });
    }

    const populatedSignal = await this.signalModel
      .findById(savedSignal._id)
      .populate('owner')
      .exec();

    const resSignal = populatedSignal || savedSignal;
    if (isFirstSignalReward) {
      (resSignal as any).isFirstSignalReward = true;
    }

    this.eventEmitter.emit(EVENTS.SIGNAL_CREATED, resSignal);
    return resSignal;
  }

  async closeSignal(signal: Signal, price: number) {
    signal.status = SignalStatus.Closed;
    signal.closedAt = new Date();
    signal.closedOuncePrice = price;
    const savedSignal = await this.signalModel
      .findByIdAndUpdate(signal._id, signal, { new: true })
      .populate('owner')
      .exec();

    const giftGems = savedSignal.score >= 10 ? Math.floor(savedSignal.score / 10) : 0;
    if (giftGems > 0) {
      await this.userModel
        .findByIdAndUpdate(savedSignal.owner._id, {
          $inc: { gem: giftGems },
        })
        .exec();

      const currentGems = savedSignal.owner.gem || 0;
      await this.gemLogModel.create({
        user: savedSignal.owner._id,
        gemsChange: giftGems,
        gemsBefore: currentGems,
        gemsAfter: currentGems + giftGems,
        action: GemLogAction.CloseSignal,
      });

      savedSignal.gem = giftGems;
      await savedSignal.save();
    }

    this.eventEmitter.emit(EVENTS.SIGNAL_CLOSED, savedSignal);
    return signal;
  }

  async activateSignal(signal: Signal): Promise<Signal> {
    const saved = await this.signalModel
      .findByIdAndUpdate(
        signal._id || (signal as any).id,
        { status: SignalStatus.Active, activeAt: new Date() },
        { new: true },
      )
      .populate('owner')
      .exec();
    this.eventEmitter.emit(EVENTS.SIGNAL_ACTIVE, saved);
    return saved;
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

  async cancelSignal(signalId: string, userId: string) {
    const signal = await this.signalModel.findById(signalId).populate('owner').exec();
    if (!signal) {
      throw new HttpException(
        { translationKey: 'userNotFound' },
        HttpStatus.NOT_FOUND,
      );
    }
    const ownerId = signal.owner?.id || (signal.owner as any)?._id?.toString();
    if (ownerId !== userId) {
      throw new HttpException(
        { translationKey: 'userNotFound' },
        HttpStatus.FORBIDDEN,
      );
    }
    if (signal.status !== SignalStatus.Pending) {
      throw new HttpException(
        { translationKey: 'signal.invalidEntry' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.removeSignal(signal);
  }

  async manualCloseSignal(signalId: string, userId: string) {
    const signal = await this.signalModel.findById(signalId).populate('owner').exec();
    if (!signal) {
      throw new HttpException(
        { translationKey: 'userNotFound' },
        HttpStatus.NOT_FOUND,
      );
    }
    const ownerId = signal.owner?.id || (signal.owner as any)?._id?.toString();
    if (ownerId !== userId) {
      throw new HttpException(
        { translationKey: 'userNotFound' },
        HttpStatus.FORBIDDEN,
      );
    }
    if (signal.status !== SignalStatus.Active) {
      throw new HttpException(
        { translationKey: 'signal.invalidEntry' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.closeSignal(signal, this.ouncePriceService.current);
  }

  async makeSignalRiskFree(signalId: string, userId: string) {
    const signal = await this.signalModel.findById(signalId).populate('owner').exec();
    if (!signal) {
      throw new HttpException(
        { translationKey: 'userNotFound' },
        HttpStatus.NOT_FOUND,
      );
    }
    const ownerId = signal.owner?.id || (signal.owner as any)?._id?.toString();
    if (ownerId !== userId) {
      throw new HttpException(
        { translationKey: 'userNotFound' },
        HttpStatus.FORBIDDEN,
      );
    }
    if (signal.status !== SignalStatus.Active) {
      throw new HttpException(
        { translationKey: 'signal.invalidEntry' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (Signal.getActivePip(signal, this.ouncePriceService.current) < 0) {
      throw new HttpException(
        { translationKey: 'signal.invalidEntry' },
        HttpStatus.BAD_REQUEST,
      );
    }
    
    const updatedSignal = await this.signalModel
      .findByIdAndUpdate(
        signalId,
        { riskFree: true },
        { new: true },
      )
      .populate('owner')
      .exec();

    this.eventEmitter.emit(EVENTS.SIGNAL_RISK_FREE, updatedSignal);
    return updatedSignal;
  }

  @OnEvent(EVENTS.MARKET_CLOSED)
  async handleMarketClosed() {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
    });
    const weekday = formatter.format(new Date());
    if (weekday === 'Friday') {
      console.log('Market weekend closed, resetting weekly signals...');
      await this.resetSignals();
      this.eventEmitter.emit(EVENTS.WEEKLY_SIGNALS_RESET);
    }
  }

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

  async analyzeSignal(
    signal: Signal,
    userId?: string,
    overrides?: { tradingStyle?: TradingStyle; riskTolerance?: RiskTolerance }
  ) {
    try {
      // Normalize incoming signal properties in case it is a partial or form-based unsaved object.
      const signalType = signal.type;
      const isSell = signalType === SignalType.Sell;
      const status = signal.status || (signal.instantEntry ? SignalStatus.Active : SignalStatus.Pending);
      
      let entryPrice = typeof signal.entryPrice === 'string' ? parseFloat(signal.entryPrice) : (signal.entryPrice || 0);
      if (!entryPrice && (signal.instantEntry || status === SignalStatus.Active)) {
        entryPrice = this.ouncePriceService.current;
      }

      // Determine profit and loss
      let profit = 0;
      if (signal.profit !== undefined && signal.profit !== null) {
        profit = typeof signal.profit === 'string' ? parseFloat(signal.profit) : signal.profit;
      } else if ((signal as any).takeProfit !== undefined && (signal as any).takeProfit !== null) {
        profit = typeof (signal as any).takeProfit === 'string' ? parseFloat((signal as any).takeProfit) : (signal as any).takeProfit;
      } else {
        profit = isSell ? (signal.minPrice || 0) : (signal.maxPrice || 0);
      }

      // loss
      let loss = 0;
      if (signal.loss !== undefined && signal.loss !== null) {
        loss = typeof signal.loss === 'string' ? parseFloat(signal.loss) : signal.loss;
      } else if ((signal as any).stopLoss !== undefined && (signal as any).stopLoss !== null) {
        loss = typeof (signal as any).stopLoss === 'string' ? parseFloat((signal as any).stopLoss) : (signal as any).stopLoss;
      } else {
        loss = isSell ? (signal.maxPrice || 0) : (signal.minPrice || 0);
      }

      // Check if user has gems
      const targetUserId = userId || (signal.owner && (typeof signal.owner === 'object' ? signal.owner._id || (signal.owner as any).id : signal.owner));
      if (!targetUserId) {
        throw new NotFoundException({
          translationKey: 'userNotFound',
        });
      }

      const user = await this.userModel.findById(targetUserId).exec();
      if (!user) {
        throw new NotFoundException({
          translationKey: 'userNotFound',
        });
      }

      const currentPrice = this.ouncePriceService.current;
      const userLang = user.language || 'fa';
      const risk = overrides?.riskTolerance || RiskTolerance.Moderate;

      if (!user.gem || user.gem <= 0) {
        throw new NotAcceptableException({
          translationKey: 'insufficientGems',
        });
      }

      // Fetch recent 5m candles from the past 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const candles5m = await this.candleModel.find({
        timestamp: { $gte: thirtyDaysAgo }
      }).sort({ timestamp: 1 }).exec();

      if (candles5m.length === 0) {
        throw new HttpException("No market data available", HttpStatus.BAD_REQUEST);
      }

      // Calculate PDH/PDL and ADR14 using MongoDB Aggregation (sorted to correctly obtain open/close prices)
      const dailyAgg = await this.candleModel.aggregate([
        { $sort: { timestamp: 1 } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
            },
            high: { $max: "$high" },
            low: { $min: "$low" },
            open: { $first: "$open" },
            close: { $last: "$close" },
            date: { $first: "$timestamp" }
          }
        },
        { $sort: { _id: -1 } },
        { $skip: 1 }, // skip ongoing day
        { $limit: 14 }
      ]).exec();

      let pdh = currentPrice;
      let pdl = currentPrice;
      let adr14 = 4.0;
      if (dailyAgg.length > 0) {
        pdh = dailyAgg[0].high;
        pdl = dailyAgg[0].low;
        const ranges = dailyAgg.map((d: any) => d.high - d.low);
        const sum = ranges.reduce((a: number, b: number) => a + b, 0);
        adr14 = sum / dailyAgg.length;
      }

      const marketState = analyzeMarketState(currentPrice, candles5m, { pdh, pdl, adr14 });

      // Fetch external index prices and their daily percent changes
      const dxyData = await this.getCachedYahooPriceAndChange('DX-Y.NYB');
      const us10yData = await this.getCachedYahooPriceAndChange('^TNX');
      const dxy = dxyData ? dxyData.price : null;
      const us10y = us10yData ? us10yData.price : null;

      // Fetch economic calendar news check
      const newsCheck = await this.isNearHighImpactUSDNews();

      // Build the rich context JSON
      const marketContextJson = buildMarketContextJson(
        currentPrice,
        candles5m,
        dailyAgg,
        dxyData,
        us10yData,
        newsCheck,
        this.ouncePriceService.isMarketOpen()
      );

      const result = await this.aiOrchestratorService.analyzeSignal(
        signal,
        userLang,
        currentPrice,
        marketState,
        dxy,
        us10y,
        newsCheck,
        overrides,
        marketContextJson
      );

      // Deduct 1 gem from user
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

      const style = overrides?.tradingStyle || detectTradingStyle(Math.abs(profit - entryPrice), marketState.atr1h);

      await this.signalAnalyzeModel.create({
        signal: signal.id || signal._id || null,
        ouncePrice: currentPrice,
        totalTokens: result.totalTokens,
        analyzeText: result.data.analysis,
        successProbability: result.data.successProbability,
        creator: user.id,
        prompt: `Telemetry logged in AiEvaluation table.`,
        model: result.model,
        tradingStyle: style,
        riskTolerance: risk,
        language: userLang,
      });

      return {
        analysis: result.data.analysis,
        successProbability: result.data.successProbability,
        signal,
        user,
        currentPrice: currentPrice,
        totalTokens: result.totalTokens,
      };
    } catch (error) {
      console.error('Error in analyzeSignal service:', error);
      throw error;
    }
  }

  async generateSignal(
    userId: string,
    overrides?: { tradingStyle?: TradingStyle; riskTolerance?: RiskTolerance }
  ) {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new NotFoundException({
          translationKey: 'userNotFound',
        });
      }

      if (!user.gem || user.gem < 2) {
        throw new NotAcceptableException({
          translationKey: 'insufficientGems',
        });
      }

      // 1. High-Impact USD News Kill Switch Check
      const newsCheck = await this.isNearHighImpactUSDNews();
      if (newsCheck.near) {
        console.log(`News Kill Switch triggered: high impact news "${newsCheck.eventName}" in ${newsCheck.timeDiffMinutes} mins.`);
        return {
          signal: null,
          rawText: JSON.stringify({
            type: null,
            entryPrice: null,
            takeProfit: null,
            stopLoss: null,
            instantEntry: false,
            generationAnalysis: user.language === 'fa' 
              ? `به دلیل انتشار خبر مهم اقتصادی آمریکا (${newsCheck.eventName}) در محدوده ۳۰ دقیقه‌ای، جهت ایمنی سرمایه شما سیگنال جدیدی صادر نمی‌شود.`
              : `Due to the release of high-impact US economic news (${newsCheck.eventName}) within 30 minutes, no new signal is generated to protect your capital.`
          }),
          parseError: false,
          user,
          model: 'News Kill Switch',
        };
      }

      const currentPrice = this.ouncePriceService.current;

      // Fetch recent 5m candles from the past 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const candles5m = await this.candleModel.find({
        timestamp: { $gte: thirtyDaysAgo }
      }).sort({ timestamp: 1 }).exec();

      if (candles5m.length === 0) {
        throw new HttpException("No market data available", HttpStatus.BAD_REQUEST);
      }

      // Calculate PDH/PDL and ADR14 using MongoDB Aggregation (sorted to correctly obtain open/close prices)
      const dailyAgg = await this.candleModel.aggregate([
        { $sort: { timestamp: 1 } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
            },
            high: { $max: "$high" },
            low: { $min: "$low" },
            open: { $first: "$open" },
            close: { $last: "$close" },
            date: { $first: "$timestamp" }
          }
        },
        { $sort: { _id: -1 } },
        { $skip: 1 }, // skip ongoing day
        { $limit: 14 }
      ]).exec();

      let pdh = currentPrice;
      let pdl = currentPrice;
      let adr14 = 4.0;
      if (dailyAgg.length > 0) {
        pdh = dailyAgg[0].high;
        pdl = dailyAgg[0].low;
        const ranges = dailyAgg.map((d: any) => d.high - d.low);
        const sum = ranges.reduce((a: number, b: number) => a + b, 0);
        adr14 = sum / dailyAgg.length;
      }

      const marketState = analyzeMarketState(currentPrice, candles5m, { pdh, pdl, adr14 });
      const userLang = user.language || 'fa';

      const dxyData = await this.getCachedYahooPriceAndChange('DX-Y.NYB');
      const us10yData = await this.getCachedYahooPriceAndChange('^TNX');
      const dxy = dxyData ? dxyData.price : null;
      const us10y = us10yData ? us10yData.price : null;

      // Build the rich context JSON
      const marketContextJson = buildMarketContextJson(
        currentPrice,
        candles5m,
        dailyAgg,
        dxyData,
        us10yData,
        newsCheck,
        this.ouncePriceService.isMarketOpen()
      );

      const result = await this.aiOrchestratorService.generateSignal(
        userLang,
        currentPrice,
        marketState,
        dxy,
        us10y,
        newsCheck,
        overrides,
        marketContextJson
      );

      const generatedSignal = result.data.type ? {
        type: result.data.type,
        entryPrice: result.data.entryPrice,
        takeProfit: result.data.takeProfit,
        stopLoss: result.data.stopLoss,
        instantEntry: result.data.instantEntry,
        successProbability: result.data.successProbability,
        generationAnalysis: result.data.generationAnalysis
      } : null;

      // Deduct 2 gems from user only if a signal was successfully generated
      if (generatedSignal) {
        await this.userModel
          .findByIdAndUpdate(user.id, {
            $inc: { gem: -2 },
          })
          .exec();

        this.gemLogModel.create({
          user: user.id,
          gemsChange: -2,
          gemsBefore: user.gem,
          gemsAfter: user.gem - 2,
          action: GemLogAction.GenerateSignal,
        });
      }

      return {
        signal: generatedSignal,
        rawText: result.data.generationAnalysis,
        parseError: false,
        user,
        model: result.model,
        prompt: (result as any).prompt,
      };
    } catch (error) {
      console.error('Error in generateSignal service:', error);
      throw error;
    }
  }

  async getSubscription(signalId: string, userId: string): Promise<SignalSubscription | null> {
    return this.signalSubModel.findOne({ signal: signalId, user: userId }).exec();
  }

  async updateSubscription(
    signalId: string,
    userId: string,
    subDto: { followStatus?: boolean; aiShield?: boolean },
  ): Promise<SignalSubscription> {
    const sub = await this.signalSubModel.findOne({ signal: signalId, user: userId }).exec();
    const isEnablingShield = subDto.aiShield === true && (!sub || !sub.aiShield);

    if (isEnablingShield) {
      const user = await this.userModel.findById(userId).exec();
      if (!user || !user.gem || user.gem < 20) {
        throw new NotAcceptableException({
          translationKey: 'insufficientGems',
        });
      }

      await this.userModel.findByIdAndUpdate(userId, { $inc: { gem: -1 } }).exec();
      await this.gemLogModel.create({
        user: userId,
        gemsChange: -1,
        gemsBefore: user.gem,
        gemsAfter: user.gem - 1,
        action: GemLogAction.AiShieldEnable,
      });
    }

    let savedSub: SignalSubscription;
    if (sub) {
      if (subDto.followStatus !== undefined) sub.followStatus = subDto.followStatus;
      if (subDto.aiShield !== undefined) sub.aiShield = subDto.aiShield;
      savedSub = await sub.save();
    } else {
      savedSub = await this.signalSubModel.create({
        signal: signalId,
        user: userId,
        followStatus: subDto.followStatus ?? false,
        aiShield: subDto.aiShield ?? false,
      });
    }
    const populatedSub = await this.signalSubModel
      .findById(savedSub._id)
      .populate('user')
      .exec();
    this.eventEmitter.emit(EVENTS.SIGNAL_SUBSCRIPTION_UPDATED, populatedSub || savedSub);
    return populatedSub || savedSub;
  }

  async getMarketState() {
    const currentPrice = this.ouncePriceService.current;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const candles5m = await this.candleModel.find({
      timestamp: { $gte: thirtyDaysAgo }
    }).sort({ timestamp: 1 }).exec();

    if (candles5m.length === 0) {
      throw new HttpException("No market data available", HttpStatus.BAD_REQUEST);
    }

    return analyzeMarketState(currentPrice, candles5m);
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

function aggregateTo4h(candles5m: OuncePriceCandle[]): { timestamp: Date; open: number; high: number; low: number; close: number }[] {
  const candles4h: { timestamp: Date; open: number; high: number; low: number; close: number }[] = [];
  const groups: { [key: string]: OuncePriceCandle[] } = {};

  for (const candle of candles5m) {
    const date = new Date(candle.timestamp);
    const hour = date.getUTCHours();
    const alignedHour = Math.floor(hour / 4) * 4;
    date.setUTCHours(alignedHour, 0, 0, 0);
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

    candles4h.push({ timestamp, open, high, low, close });
  }
  return candles4h;
}

export function getStyleInstructions(
  style?: TradingStyle,
  risk?: RiskTolerance,
): string {
  let styleInstructions = `\nSTYLE & RISK PROFILE SETTINGS (MUST FOLLOW STRICTLY):\n`;

  const finalStyle = style || TradingStyle.Day;
  const finalRisk = risk || RiskTolerance.Moderate;

  if (finalStyle === TradingStyle.Scalp) {
    styleInstructions += `- Trading Style: SCALPING (Very short-term trading). Focus heavily on the 5-minute and 15-minute timeframes. Use the 5m and 15m SMA20/SMA50 to determine momentum. For BUY setups, the entry price should be above 5m/15m SMAs or at a key support/OB/FVG. For SELL setups, the entry price should be below 5m/15m SMAs or at a key resistance/OB/FVG. Check short-term Price Action (candle rejections or breakout candles) at the 15m support/resistance levels. Ignore 1h/4h structures except as minor background direction. Suggest tighter stop loss levels (e.g. 1.0x ATR) and closer take profit levels.\n`;
  } else if (finalStyle === TradingStyle.Swing) {
    styleInstructions += `- Trading Style: SWING TRADING (Medium to long-term trading). Focus on the 1-hour and 4-hour horizontal S/R structures. Completely ignore 5-minute and 15-minute noise. Suggest wider stop losses and larger take profit targets (at least 2.0x to 3.0x risk move) to allow the trade room to develop.\n`;
  } else {
    styleInstructions += `- Trading Style: DAY TRADING (Intraday trading). Look to enter and exit within the day. Balance 15m momentum (using 15m SMA20/50 alignment) with 1h structure (using 1h SMA20/50 and horizontal S/R). Ensure entry/exit targets are not blocked by key short-term (15m) or medium-term (1h) levels. Price action rejections at 15m or 1h support/resistance are critical.\n`;
  }

  if (finalRisk === RiskTolerance.Conservative) {
    styleInstructions += `- Risk Tolerance: CONSERVATIVE (Low Risk). You must strictly follow the dominant trend direction (BUY when dominant trend is BULLISH, SELL when dominant trend is BEARISH). Reject any trade if there is a major horizontal barrier blocking the path to the TP. Risk-Reward ratio must be at least 2.0.\n`;
  } else if (finalRisk === RiskTolerance.Aggressive) {
    styleInstructions += `- Risk Tolerance: AGGRESSIVE (High Risk). You are allowed to suggest counter-trend breakout setups if momentum (RSI) is extremely strong in that direction. The Risk-Reward ratio can be as low as 1.2 if the momentum supports a quick target touch.\n`;
  } else {
    styleInstructions += `- Risk Tolerance: MODERATE. Standard risk management rules apply (Risk-Reward ratio between 1.5 and 3.0).\n`;
  }

  return styleInstructions;
}
