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
          signal.save().then(async (savedSignal) => {
            const populatedSignal = await this.signalModel
              .findById(savedSignal._id)
              .populate('owner')
              .exec();
            this.eventEmitter.emit(EVENTS.SIGNAL_ACTIVE, populatedSignal || savedSignal);
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
    try {
      // Check if user has gems
      const targetUserId = userId || (signal.owner && (typeof signal.owner === 'object' ? signal.owner._id || (signal.owner as any).id : signal.owner));
      if (!targetUserId) {
        throw new NotFoundException({
          translationKey: 'userNotFound',
        });
      }

      const user = await this.userModel
        .findById(targetUserId)
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

      // Fetch recent 5m candles from the past 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const candles5m = await this.candleModel.find({
        timestamp: { $gte: thirtyDaysAgo }
      }).sort({ timestamp: 1 }).exec();

      // Prepare default values
      let formattedHistory4h = 'No historical data available.';
      let formattedHistory1h = 'No historical data available.';
      let formattedHistory15m = 'No historical data available.';
      let formattedHistory5m = 'No historical data available.';
      let rsi5m = 50;
      let rsi15m = 50;
      let rsi1h = 50;
      let sma20_5m = currentPrice;
      let sma20_1h = currentPrice;
      let sma50_1h = currentPrice;
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
        sma20_1h = calculateSMA(closes1h, 20);
        sma50_1h = calculateSMA(closes1h, 50);

        const formatCandle = (c: any) => {
          const dateStr = new Date(c.timestamp).toISOString().replace('T', ' ').substring(5, 16);
          return `${dateStr},${c.open.toFixed(2)},${c.high.toFixed(2)},${c.low.toFixed(2)},${c.close.toFixed(2)}`;
        };

        const candles4h = aggregateTo4h(candles5m);
        if (candles4h.length > 0) {
          formattedHistory4h = candles4h.map(formatCandle).join('\n');
        }
        if (candles1h.length > 0) {
          formattedHistory1h = candles1h.slice(-72).map(formatCandle).join('\n'); // last 3 days
        }
        if (candles15m.length > 0) {
          formattedHistory15m = candles15m.slice(-48).map(formatCandle).join('\n'); // last 12 hours
        }
        formattedHistory5m = candles5m.slice(-24).map(formatCandle).join('\n'); // last 2 hours
      }

      const userLang = user.language || 'en';
      const langConfig = {
        fa: {
          name: 'Persian (Farsi)',
          label: '📊 شانس موفقیت سیگنال',
          high: '🟢 بالا',
          medium: '🟡 متوسط',
          low: '🔴 پایین',
          exampleHigh: '📊 شانس موفقیت سیگنال: 🟢 بالا - هم‌جهت با شتاب خریداران در تایم‌فریم کوتاه‌مدت',
          exampleLow: '📊 شانس موفقیت سیگنال: 🔴 پایین - بر خلاف روند اصلی ۵ دقیقه‌ای',
          doubleSidedExample: '"از یک سو ... و از سوی دیگر ...", "شاید صعودی باشد یا نزولی"',
          bluntExamples: '"حد ضرر خیلی پایینه، بهتره رو نقطه فلان باشه"، "این سری احتمالا نقطه ورود رو اصلا تاچ نمیکنه" و "بازار کاملا برعکس این میره جلو و کاملا اشتباهه"',
        },
        en: {
          name: 'English',
          label: '📊 Signal Success Chance',
          high: '🟢 High',
          medium: '🟡 Medium',
          low: '🔴 Low',
          exampleHigh: '📊 Signal Success Chance: 🟢 High - Aligned with buyer momentum in the short-term timeframe',
          exampleLow: '📊 Signal Success Chance: 🔴 Low - Against the main 5-minute trend',
          doubleSidedExample: '"on one hand ... and on the other hand ...", "it might go up or it might go down"',
          bluntExamples: '"The stop loss is too tight, it should be at level X", "It is highly unlikely to touch the entry price this time" and "The market will move completely against this trade and it is totally wrong"',
        },
        ar: {
          name: 'Arabic',
          label: '📊 فرصة نجاح الإشارة',
          high: '🟢 مرتفعة',
          medium: '🟡 متوسطة',
          low: '🔴 منخفضة',
          exampleHigh: '📊 فرصة نجاح الإشارة: 🟢 مرتفعة - متوافقة مع زخم المشترين في الإطار الزمني قصير المدى',
          exampleLow: '📊 فرصة نجاح الإشارة: 🔴 منخفضة - عكس الاتجاه الرئيسي لـ 5 دقائق',
          doubleSidedExample: '"من ناحية ... ومن ناحية أخرى ...", "قد يكون صعودياً أو هبوطياً"',
          bluntExamples: '"حد وقف الخسارة قريب جداً، من الأفضل أن يكون عند مستوى X"، "من غير المرجح إطلاقاً أن يلمس سعر الدخول هذه المرة" و"السوق سيسير تماماً عكس ذلك وهو خاطئ تماماً"',
        },
        tr: {
          name: 'Turkish',
          label: '📊 Sinyal Başarı Şansı',
          high: '🟢 Yüksek',
          medium: '🟡 Orta',
          low: '🔴 Düşük',
          exampleHigh: '📊 Sinyal Başarı Şansı: 🟢 Yüksek - Kısa vadeli zaman diliminde alıcı ivmesiyle uyumlu',
          exampleLow: '📊 Sinyal Başarı Şansı: 🔴 Düşük - 5 dakikalık ana trendin tersine',
          doubleSidedExample: '"bir yandan ... diğer yandan ...", "yükseliş de olabilir düşüş de"',
          bluntExamples: '"Zarar durdurma çok yakın, X seviyesinde olması daha iyi", "Bu sefer giriş fiyatına ulaşması pek olası değil" ve "Piyasa bunun tamamen aksine gidecek ve bu tamamen yanlış"',
        }
      }[userLang as 'fa' | 'en' | 'ar' | 'tr'] || {
        name: 'English',
        label: '📊 Signal Success Chance',
        high: '🟢 High',
        medium: '🟡 Medium',
        low: '🔴 Low',
        exampleHigh: '📊 Signal Success Chance: 🟢 High - Aligned with buyer momentum in the short-term timeframe',
        exampleLow: '📊 Signal Success Chance: 🔴 Low - Against the main 5-minute trend',
        doubleSidedExample: '"on one hand ... and on the other hand ...", "it might go up or it might go down"',
        bluntExamples: '"The stop loss is too tight, it should be at level X", "It is highly unlikely to touch the entry price this time" and "The market will move completely against this trade and it is totally wrong"',
      };

      const promptMessage = `
You are an expert, extremely bold, decisive, and authoritative financial analyst AI for Ounce24.
Analyze the following short-term Gold (XAUUSD) signal based on the technical price history and indicators provided below.

Signal Details:
- Action Type: ${signal.type === SignalType.Buy ? 'BUY' : 'SELL'}
- Signal Status: ${signal.status.toUpperCase()}
- Placed Time (Created): ${signal.createdAt ? new Date(signal.createdAt).toISOString().replace('T', ' ').substring(5, 16) : 'N/A'}
${signal.activeAt ? `- Triggered/Activated Time: ${new Date(signal.activeAt).toISOString().replace('T', ' ').substring(5, 16)}` : ''}
${signal.closedAt ? `- Closed/Finished Time: ${new Date(signal.closedAt).toISOString().replace('T', ' ').substring(5, 16)}` : ''}
${signal.closedOuncePrice ? `- Closed Ounce Price: $${signal.closedOuncePrice.toFixed(2)}` : ''}
- Current Price: $${currentPrice.toFixed(2)}
- Entry Price: $${signal.entryPrice.toFixed(2)}
- Take Profit (TP): $${signal.profit.toFixed(2)} (Target Move: $${Math.abs(signal.profit - signal.entryPrice).toFixed(2)})
- Stop Loss (SL): $${signal.loss.toFixed(2)} (Risk Move: $${Math.abs(signal.loss - signal.entryPrice).toFixed(2)})

Technical Indicators (Calculated on 5m, 15m, 1h tables):
- 5m RSI(14): ${rsi5m.toFixed(2)}
- 15m RSI(14): ${rsi15m.toFixed(2)}
- 1h RSI(14): ${rsi1h.toFixed(2)}
- 5m SMA(20): $${sma20_5m.toFixed(2)} (Current price is ${currentPrice > sma20_5m ? 'above' : 'below'} SMA20 by $${Math.abs(currentPrice - sma20_5m).toFixed(2)})
- 1h SMA(20): $${sma20_1h.toFixed(2)}
- 1h SMA(50): $${sma50_1h.toFixed(2)}
- 5m ATR(14) (Volatility): $${atr5m.toFixed(2)}

Recent Price History (4-hour resolution, past 30 days - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory4h}

Recent Price History (1-hour resolution, past 3 days - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory1h}

Recent Price History (15-minute resolution, past 12 hours - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory15m}

Recent Price History (5-minute resolution, past 2 hours - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory5m}

Instructions for Analysis:
1. Write the analysis strictly in ${langConfig.name}.
2. Do NOT repeat or list the signal details (such as Entry Price, TP, SL, or Current Price) at the top of your response. The user already sees these details on their screen.
3. Start your response directly with the final success assessment formatted exactly as follows:
   "${langConfig.label}: [High/Medium/Low represented with a matching emoji: ${langConfig.high}, ${langConfig.medium}, ${langConfig.low}] - [1-sentence reason]"
   For example: "${langConfig.exampleLow}" or "${langConfig.exampleHigh}"
4. Provide a very brief, direct 1-line summary of your analysis right after this indicator.
5. Provide the rest of your technical analysis in 1 or 2 very short, concise paragraphs. Keep the entire response brief, clean, and to the point.
6. Prioritize technical analysis approaches by giving the highest priority to Price Action (specifically Support & Resistance levels, key breakout/breakdown levels, and market structure on the 30-day 4-hour price history) and secondary priority to Moving Average trends (using SMA20/SMA50 indicators). RSI and other momentum tools are of much lower priority.
7. Do NOT make double-sided, hesitant, or fence-sitting statements (e.g., ${langConfig.doubleSidedExample}). You must be extremely bold, decisive, and opinionated. Provide direct, blunt judgment and suggestions in ${langConfig.name} using your own natural technical analytical vocabulary to fit the context. The phrasings ${langConfig.bluntExamples} are illustrative examples of the expected level of confidence, directness, and bluntness—not strict templates to copy-paste. Give professional, analytical, and highly confident feedback.
8. Output all numbers (prices, RSI values, target moves, etc.) strictly using English digits (e.g. 2350.50), not Persian digits.
9. Use only plain text with newlines/spacing for formatting. Use emojis to make the text engaging.
10. Do NOT use asterisks (*) or underscores (_) or any other markdown/HTML formatting characters in your text. They look ugly and must be completely avoided. Just write plain clean text.
11. Ensure all price levels, support/resistance levels, and targets you mention are mathematically and logically correct. For a BUY signal, a resistance level ONLY blocks/obstructs the signal's target (TP) if it is located between the Entry Price and the TP (Entry < Resistance < TP). If the resistance is higher than the TP (Resistance > TP), it does NOT block the target, and you must not claim it blocks. Conversely, for a SELL signal, a support level only blocks the TP if it is between the Entry and TP (Entry > Support > TP). Do not hallucinate or make false claims about support/resistance blocking targets if they are outside this mathematical range. Double-check your numeric logic.
12. Whenever you refer to a support level, resistance level, moving average, or past key level, ALWAYS state its exact price number (using English digits) instead of using abstract terms. For example, instead of "previous resistance", say "resistance level at [price]" or its translation in ${langConfig.name}, and instead of "key support", say "support level at [price]" or its translation in ${langConfig.name}. Never mention a price level or chart concept without including its specific numerical value.
13. Be highly aware of the Signal Status:
   - If the status is PENDING:
     - Understand that the trade is NOT live yet. The price must first reach/touch the Entry Price.
     - For a BUY signal where the Entry Price is below the Current Price (e.g. Entry 4426.00 and Current Price 4449.16), the price must first drop (pullback) to trigger the buy entry. Calculate the distance between Current Price and Entry Price. If they are far apart, explain that the price needs to pullback to trigger, and state if it's unlikely to touch the entry ("It is unlikely to touch the entry price" or its translation in ${langConfig.name}) based on the current market momentum/consolidation.
     - For a SELL signal where the Entry Price is above the Current Price, the price must rise to trigger.
     - Do NOT treat the Take Profit (TP) target level as a "resistance level that must be broken" for the signal to succeed. Reaching the TP is the goal of the trade, not a barrier.
   - If the status is CLOSED or CANCELED:
     - Understand that this is a past, finished trade. Your analysis must be a post-mortem technical review (an educational review of what happened in hindsight). Do NOT write a future forecast.
     - Look at the Placed Time, Triggered/Activated Time, and Closed/Finished Time. Review how the price moved during this active period based on the price history.
     - Analyze whether the signal reached its TP (Success) or hit SL (Failure), or remained pending and was canceled without triggering. State clearly in hindsight if the Entry, TP, and SL levels were well-placed or poorly positioned relative to the actual price action. Give honest, blunt, and educational feedback on the trade setup.
`;

      const result = await this.aiChatService.createResponse(promptMessage, userLang);

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
        prompt: promptMessage,
        model: result.model,
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

  async generateSignal(userId: string) {
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

      // Prepare default values
      let formattedHistory4h = 'No historical data available.';
      let formattedHistory1h = 'No historical data available.';
      let formattedHistory15m = 'No historical data available.';
      let formattedHistory5m = 'No historical data available.';
      let rsi5m = 50;
      let rsi15m = 50;
      let rsi1h = 50;
      let sma20_5m = currentPrice;
      let sma20_1h = currentPrice;
      let sma50_1h = currentPrice;
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
        sma20_1h = calculateSMA(closes1h, 20);
        sma50_1h = calculateSMA(closes1h, 50);

        const formatCandle = (c: any) => {
          const dateStr = new Date(c.timestamp).toISOString().replace('T', ' ').substring(5, 16);
          return `${dateStr},${c.open.toFixed(2)},${c.high.toFixed(2)},${c.low.toFixed(2)},${c.close.toFixed(2)}`;
        };

        const candles4h = aggregateTo4h(candles5m);
        if (candles4h.length > 0) {
          formattedHistory4h = candles4h.map(formatCandle).join('\n');
        }
        if (candles1h.length > 0) {
          formattedHistory1h = candles1h.slice(-72).map(formatCandle).join('\n'); // last 3 days
        }
        if (candles15m.length > 0) {
          formattedHistory15m = candles15m.slice(-48).map(formatCandle).join('\n'); // last 12 hours
        }
        formattedHistory5m = candles5m.slice(-24).map(formatCandle).join('\n'); // last 2 hours
      }

      const promptMessage = `
You are an expert, bold, and authoritative quantitative trading system for Ounce24.
Generate a high-probability short-term Gold (XAUUSD) trading signal based on the technical price history and indicators provided below.

Current Price: $${currentPrice.toFixed(2)}

Technical Indicators (Calculated on 5m, 15m, 1h tables):
- 5m RSI(14): ${rsi5m.toFixed(2)}
- 15m RSI(14): ${rsi15m.toFixed(2)}
- 1h RSI(14): ${rsi1h.toFixed(2)}
- 5m SMA(20): $${sma20_5m.toFixed(2)} (Current price is ${currentPrice > sma20_5m ? 'above' : 'below'} SMA20 by $${Math.abs(currentPrice - sma20_5m).toFixed(2)})
- 1h SMA(20): $${sma20_1h.toFixed(2)}
- 1h SMA(50): $${sma50_1h.toFixed(2)}
- 5m ATR(14) (Volatility): $${atr5m.toFixed(2)}

Recent Price History (4-hour resolution, past 30 days - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory4h}

Recent Price History (1-hour resolution, past 3 days - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory1h}

Recent Price History (15-minute resolution, past 12 hours - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory15m}

Recent Price History (5-minute resolution, past 2 hours - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory5m}

Instructions for Signal Generation:
1. Analyze the trend and key Support/Resistance areas. Decide on a short-term trading setup.
2. Determine if the setup is a BUY or SELL signal.
3. Suggest a realistic Entry Price, Take Profit (TP), and Stop Loss (SL). 
4. The Stop Loss must be calculated logically based on the recent swing low/high or the ATR volatility (e.g. SL distance from entry should be at least 1.5x to 2x ATR).
5. The Risk-Reward Ratio (Target Move / Risk Move) must be between 1.5 and 3.0.
6. Decide whether to use an instant market entry (instantEntry: true) or a pending order (instantEntry: false):
   - Use "instantEntry: true" ONLY when the current price is already at an ideal technical execution zone (e.g. just breaking out of a key level or bouncing directly off a support/resistance line). In this case, entryPrice must be equal to the current price ($${currentPrice.toFixed(2)}).
   - Use "instantEntry: false" when the current price is not at an ideal level, and it is wiser to wait for a pullback to a key support/resistance level or a breakout above/below a key level. In this case, specify the target entryPrice at that future level (e.g., for a BUY pending limit order, entryPrice should be lower than the current price; for a SELL pending limit order, entryPrice should be higher than the current price).
   - Make sure to dynamically generate both instant and pending signals depending on the market structure. Do NOT always generate instant entries.
7. Return your response ONLY as a valid JSON object matching the following TypeScript interface (do NOT include any markdown code blocks, backticks, or other text):
{
  "type": "buy" | "sell",
  "entryPrice": number,
  "takeProfit": number,
  "stopLoss": number,
  "instantEntry": boolean
}
`;

      const result = await this.aiChatService.createResponse(promptMessage);

      // Clean the AI response in case it returned markdown code block
      let cleanText = result.text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }

      let generatedSignal = null;
      let parseError = false;
      try {
        generatedSignal = JSON.parse(cleanText);
      } catch (e) {
        parseError = true;
      }

      // Deduct 20 gems from user
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
