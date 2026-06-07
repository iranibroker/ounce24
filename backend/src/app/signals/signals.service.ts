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
import { AiChatService } from '../ai-chat/ai-chat.service';
import { analyzeMarketState, detectTradingStyle } from './market-analyzer.helper';

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
    @InjectModel(SignalSubscription.name)
    private signalSubModel: Model<SignalSubscription>,
    private eventEmitter: EventEmitter2,
    private ouncePriceService: OuncePriceService,
    private aiChatService: AiChatService,
    @InjectModel(SignalAnalyze.name)
    private signalAnalyzeModel: Model<SignalAnalyze>,
    @InjectModel(OuncePriceCandle.name)
    private candleModel: Model<OuncePriceCandle>,
  ) {}



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
    await this.signalSubModel.create({
      signal: savedSignal._id,
      user: owner._id,
      followStatus: true,
      aiShield: false,
    });
    const populatedSignal = await this.signalModel
      .findById(savedSignal._id)
      .populate('owner')
      .exec();
    this.eventEmitter.emit(EVENTS.SIGNAL_CREATED, populatedSignal || savedSignal);
    return populatedSignal || savedSignal;
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
      const entryPrice = typeof signal.entryPrice === 'string' ? parseFloat(signal.entryPrice) : (signal.entryPrice || 0);

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
      const risk = overrides?.riskTolerance || user.riskTolerance || RiskTolerance.Moderate;

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

      const marketState = analyzeMarketState(currentPrice, candles5m);

      // Auto-detect trading style based on target distance relative to 1h ATR
      const targetDistance = Math.abs(profit - entryPrice);
      const style = detectTradingStyle(targetDistance, marketState.atr1h);

      const langConfig = {
        fa: {
          name: 'Persian (Farsi)',
          label: '📊 شانس موفقیت سیگنال',
          high: '🟢 بالا',
          medium: '🟡 متوسط',
          low: '🔴 پایین',
        },
        en: {
          name: 'English',
          label: '📊 Signal Success Chance',
          high: '🟢 High',
          medium: '🟡 Medium',
          low: '🔴 Low',
        },
        ar: {
          name: 'Arabic',
          label: '📊 فرصة نجاح الإشارة',
          high: '🟢 مرتفعة',
          medium: '🟡 متوسطة',
          low: '🔴 منخفضة',
        },
        tr: {
          name: 'Turkish',
          label: '📊 Sinyal Başarı Şansı',
          high: '🟢 Yüksek',
          medium: '🟡 Orta',
          low: '🔴 Düşük',
        }
      }[userLang as 'fa' | 'en' | 'ar' | 'tr'] || {
        name: 'English',
        label: '📊 Signal Success Chance',
        high: '🟢 High',
        medium: '🟡 Medium',
        low: '🔴 Low',
      };

      const styleInstructions = getStyleInstructions(style, risk);

      const promptMessage = `
You are an expert Gold (XAUUSD) technical analyst AI for Ounce24.
Analyze this signal objectively using the market data below.

Signal: ${signalType === SignalType.Buy ? 'BUY' : 'SELL'} | Status: ${status.toUpperCase()} | Entry: $${entryPrice.toFixed(2)} | TP: $${profit.toFixed(2)} | SL: $${loss.toFixed(2)} | Current: $${currentPrice.toFixed(2)}
${signal.createdAt ? `Created: ${new Date(signal.createdAt).toISOString().replace('T', ' ').substring(5, 16)}` : ''}${signal.activeAt ? ` | Active: ${new Date(signal.activeAt).toISOString().replace('T', ' ').substring(5, 16)}` : ''}${signal.closedAt ? ` | Closed: ${new Date(signal.closedAt).toISOString().replace('T', ' ').substring(5, 16)} at $${signal.closedOuncePrice?.toFixed(2)}` : ''}

Market State:
${marketState.semanticText}

${styleInstructions}

Rules:
1. For BUY: price should be above 5m/15m SMA20+SMA50 for high rating. For SELL: below them.
2. Counter-trend trades = MEDIUM or LOW unless strong S/R rejection within $3.
3. If a key S/R level blocks the path to TP, rate LOW or MEDIUM.
4. SL must be behind a valid level or >= 1.5x ATR from entry.
5. R:R ratio should be 1.5-3.0 for standard risk.
6. Your rating MUST match your technical findings. Do NOT rate HIGH if indicators are bearish for a BUY.

Output format (in ${langConfig.name}):
- Line 1: "${langConfig.label}: [${langConfig.high}/${langConfig.medium}/${langConfig.low}] - [reason]"
- Line 2: Brief 1-line summary
- 1-2 short paragraphs of technical reasoning
- Do NOT repeat signal details. Do NOT use markdown (*/_). Use plain text + emojis.
- All numbers in English digits. Always state exact price levels.
- Be decisive, not fence-sitting.
${status === SignalStatus.Pending ? '- PENDING: trade is not live yet. Discuss distance to entry and touch probability.' : ''}${status === SignalStatus.Closed || status === SignalStatus.Canceled ? '- CLOSED/CANCELED: write a brief educational review of the outcome.' : ''}
`;

      const result = await this.aiChatService.createResponse(promptMessage, userLang, { temperature: 0.1 });

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
        signal: signal.id || signal._id || null,
        ouncePrice: currentPrice,
        totalTokens: result.totalTokens,
        analyzeText: result.text,
        creator: user.id,
        prompt: promptMessage,
        model: result.model,
        tradingStyle: style,
        riskTolerance: risk,
        language: userLang,
      });

      return {
        analysis: result.text,
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

      if (!user.gem || user.gem < 20) {
        throw new NotAcceptableException({
          translationKey: 'insufficientGems',
        });
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

      const marketState = analyzeMarketState(currentPrice, candles5m);
      const userLang = user.language || 'fa';
      const langName = userLang === 'fa' ? 'Persian (Farsi)' : 'English';

      const style = overrides?.tradingStyle || user.tradingStyle || TradingStyle.Day;
      const risk = overrides?.riskTolerance || user.riskTolerance || RiskTolerance.Moderate;
      const styleInstructions = getStyleInstructions(style, risk);

      const promptMessage = `
You are a strict Gold (XAUUSD) quantitative trading system for Ounce24.
Generate ONLY high-confidence signals that pass ALL checks below. If no valid setup exists, return null.

Market State:
${marketState.semanticText}

${styleInstructions}

Strict Rules (MUST ALL pass to generate a signal):
1. Direction MUST align with the dominant trend. For BUY: price must be above 5m and 15m SMA20+SMA50. For SELL: below them. NEVER generate counter-trend signals.
2. No key S/R level may block the path from Entry to TP.
3. SL must be behind a valid swing level or >= 1.5x ATR from Entry.
4. R:R ratio must be 1.5-3.0 for standard risk.
5. Use instantEntry=true ONLY if current price is at an ideal level. Otherwise set a limit entry.
6. SELF-CHECK: Before outputting, verify your signal would receive a HIGH success rating if analyzed. If it would receive MEDIUM or LOW, do NOT output it — return null instead.

Output: Return ONLY a valid JSON object (no markdown, no backticks):
{"type":"buy"|"sell","entryPrice":number,"takeProfit":number,"stopLoss":number,"instantEntry":boolean,"generationAnalysis":"Brief 1-2 paragraph reasoning in ${langName}. No asterisks or markdown."}
OR if no valid setup exists: {"type":null}
`;

      const result = await this.aiChatService.createResponse(promptMessage, userLang, { temperature: 0.1 });

      // Clean the AI response in case it returned markdown code block
      let cleanText = result.text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }

      let generatedSignal = null;
      let parseError = false;
      try {
        const parsed = JSON.parse(cleanText);
        // If AI returned null signal (no valid setup)
        if (!parsed || parsed.type === null || parsed.type === 'null') {
          generatedSignal = null;
        } else {
          generatedSignal = parsed;
        }
      } catch (e) {
        parseError = true;
      }

      // Coherence check: if signal was generated, do a quick validation
      if (generatedSignal && !parseError) {
        const isBuy = generatedSignal.type === 'buy';
        const entry = generatedSignal.entryPrice || 0;
        const tp = generatedSignal.takeProfit || 0;
        const sl = generatedSignal.stopLoss || 0;

        // Basic logical validation
        const logicallyValid = isBuy
          ? (tp > entry && sl < entry)
          : (tp < entry && sl > entry);

        // Trend alignment check
        const trendAligned = isBuy
          ? (marketState.trend5m !== 'Bearish' && marketState.trend15m !== 'Bearish')
          : (marketState.trend5m !== 'Bullish' && marketState.trend15m !== 'Bullish');

        if (!logicallyValid || !trendAligned) {
          // Signal failed coherence check — discard it
          generatedSignal = null;
          parseError = true;
          cleanText = cleanText + '\n\n[Signal rejected by coherence check: failed trend/logic validation]';
        }
      }

      // Deduct 20 gems from user only if a signal was successfully generated
      if (generatedSignal && !parseError) {
        await this.userModel
          .findByIdAndUpdate(user.id, {
            $inc: { gem: -20 },
          })
          .exec();

        this.gemLogModel.create({
          user: user.id,
          gemsChange: -20,
          gemsBefore: user.gem,
          gemsAfter: user.gem - 20,
          action: GemLogAction.GenerateSignal,
        });
      }

      return {
        signal: generatedSignal,
        rawText: cleanText,
        parseError,
        user,
        model: result.model,
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
    if (subDto.aiShield === true) {
      const user = await this.userModel.findById(userId).exec();
      if (!user || !user.gem || user.gem < 100) {
        throw new NotAcceptableException({
          translationKey: 'insufficientGems',
        });
      }
    }

    const sub = await this.signalSubModel.findOne({ signal: signalId, user: userId }).exec();
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
    styleInstructions += `- Trading Style: SCALPING (Very short-term trading). Focus heavily on the 5-minute and 15-minute timeframes. Use the 5m and 15m SMA20/SMA50 to determine momentum. For BUY setups, price should be above 5m and 15m SMAs. For SELL setups, price should be below 5m and 15m SMAs. Check short-term Price Action (candle rejections or breakout candles) at the 15m support/resistance levels. Ignore 1h/4h structures except as minor background direction. Suggest tighter stop loss levels (e.g. 1.0x ATR) and closer take profit levels.\n`;
  } else if (finalStyle === TradingStyle.Swing) {
    styleInstructions += `- Trading Style: SWING TRADING (Medium to long-term trading). Focus on the 1-hour and 4-hour horizontal S/R structures. Completely ignore 5-minute and 15-minute noise. Suggest wider stop losses and larger take profit targets (at least 2.0x to 3.0x risk move) to allow the trade room to develop.\n`;
  } else {
    styleInstructions += `- Trading Style: DAY TRADING (Intraday trading). Look to enter and exit within the day. Balance 15m momentum (using 15m SMA20/50 alignment) with 1h structure (using 1h SMA20/50 and horizontal S/R). Ensure entry/exit targets are not blocked by key short-term (15m) or medium-term (1h) levels. Price action rejections at 15m or 1h support/resistance are critical.\n`;
  }

  if (finalRisk === RiskTolerance.Conservative) {
    styleInstructions += `- Risk Tolerance: CONSERVATIVE (Low Risk). You must strictly follow the trend direction (BUY when trend is BULLISH, SELL when trend is BEARISH). Reject any trade if there is a major horizontal barrier blocking the path to the TP. Risk-Reward ratio must be at least 2.0.\n`;
  } else if (finalRisk === RiskTolerance.Aggressive) {
    styleInstructions += `- Risk Tolerance: AGGRESSIVE (High Risk). You are allowed to suggest counter-trend breakout setups if momentum (RSI) is extremely strong in that direction. The Risk-Reward ratio can be as low as 1.2 if the momentum supports a quick target touch.\n`;
  } else {
    styleInstructions += `- Risk Tolerance: MODERATE. Standard risk management rules apply (Risk-Reward ratio between 1.5 and 3.0).\n`;
  }

  return styleInstructions;
}
