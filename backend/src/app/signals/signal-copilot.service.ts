import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Signal,
  SignalStatus,
  SignalType,
  User,
  OuncePriceCandle,
  SignalSubscription,
  GemLog,
  GemLogAction,
} from '@ounce24/types';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import { EVENTS } from '../consts';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { AiChatService } from '../ai-chat/ai-chat.service';
import { WebPushService } from '../web-push/web-push.service';
import { SignalsService } from './signals.service';
import { getTranslation } from '../bot/i18n';


interface CachedSubscription {
  userId: string;
  telegramId?: number;
  language: string;
  gem: number;
  followStatus: boolean;
  aiShield: boolean;
  /** User-level notification flags */
  notifSignalFollow: boolean;
  notifAiShield: boolean;
}

interface CachedSignal {
  id: string;
  type: SignalType;
  status: SignalStatus;
  entryPrice: number;
  maxPrice: number;
  minPrice: number;
  createdOuncePrice: number;
  riskFree: boolean;
  lastAiCheckedAt?: Date;
  lastAiCheckedPrice?: number;
  ownerId: string;
  subscriptions: Map<string, CachedSubscription>;
}

@Injectable()
export class SignalCopilotService implements OnModuleInit {
  private readonly logger = new Logger(SignalCopilotService.name);
  private isProcessing = false;

  // In-memory RAM Cache of all active and pending signals
  private signalCache = new Map<string, CachedSignal>();

  constructor(
    @InjectModel(Signal.name) private readonly signalModel: Model<Signal>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(SignalSubscription.name)
    private readonly signalSubModel: Model<SignalSubscription>,
    @InjectModel(GemLog.name) private readonly gemLogModel: Model<GemLog>,
    @InjectModel(OuncePriceCandle.name)
    private readonly candleModel: Model<OuncePriceCandle>,
    private readonly ouncePriceService: OuncePriceService,
    private readonly aiChatService: AiChatService,
    private readonly webPushService: WebPushService,
    private readonly eventEmitter: EventEmitter2,
    private readonly signalsService: SignalsService,
    @InjectBot('main') private readonly bot: Telegraf<Context>,
  ) {}

  // 1. Initial Cache Load on server startup
  async onModuleInit() {
    this.logger.log('Initializing Ounce24 Dynamic Copilot RAM Cache...');
    try {
      const activeOrPendingSignals = await this.signalModel
        .find({
          status: { $in: [SignalStatus.Pending, SignalStatus.Active] },
          deletedAt: null,
        })
        .exec();

      for (const signal of activeOrPendingSignals) {
        const signalIdStr = signal._id.toString();

        const subscriptions = await this.signalSubModel
          .find({ signal: signal._id })
          .populate('user')
          .exec();

        const subsMap = new Map<string, CachedSubscription>();
        for (const sub of subscriptions) {
          if (sub.user) {
            const userObj = sub.user;
            subsMap.set(userObj._id.toString(), {
              userId: userObj._id.toString(),
              telegramId: userObj.telegramId,
              language: userObj.language || 'fa',
              gem: userObj.gem || 0,
              followStatus: sub.followStatus,
              aiShield: sub.aiShield,
              notifSignalFollow: userObj.notifSignalFollow !== false,
              notifAiShield: userObj.notifAiShield !== false,
            });
          }
        }

        this.signalCache.set(signalIdStr, {
          id: signalIdStr,
          type: signal.type,
          status: signal.status,
          entryPrice: signal.entryPrice,
          maxPrice: signal.maxPrice,
          minPrice: signal.minPrice,
          createdOuncePrice: signal.createdOuncePrice || 0,
          riskFree: signal.riskFree || false,
          lastAiCheckedAt: signal.lastAiCheckedAt,
          lastAiCheckedPrice: signal.lastAiCheckedPrice,
          ownerId: signal.owner?.toString() || '',
          subscriptions: subsMap,
        });
      }

      this.logger.log(`Copilot RAM Cache successfully loaded with ${this.signalCache.size} signals.`);
    } catch (error) {
      this.logger.error('Failed to initialize Copilot RAM cache:', error);
    }
  }

  // 2. Dynamic Cache Synchronization Listeners
  @OnEvent(EVENTS.SIGNAL_CREATED)
  async handleCacheSignalCreated(signal: Signal) {
    const signalIdStr = (signal._id || signal.id).toString();
    this.logger.log(`Cache Sync: Adding newly created signal ${signalIdStr}`);

    const subscriptions = await this.signalSubModel
      .find({ signal: signal._id || signal.id })
      .populate('user')
      .exec();

    const subsMap = new Map<string, CachedSubscription>();
    for (const sub of subscriptions) {
      if (sub.user) {
        const userObj = sub.user;
        subsMap.set(userObj._id.toString(), {
          userId: userObj._id.toString(),
          telegramId: userObj.telegramId,
          language: userObj.language || 'fa',
          gem: userObj.gem || 0,
          followStatus: sub.followStatus,
          aiShield: sub.aiShield,
          notifSignalFollow: userObj.notifSignalFollow !== false,
          notifAiShield: userObj.notifAiShield !== false,
        });
      }
    }

    this.signalCache.set(signalIdStr, {
      id: signalIdStr,
      type: signal.type,
      status: signal.status,
      entryPrice: signal.entryPrice,
      maxPrice: signal.maxPrice,
      minPrice: signal.minPrice,
      createdOuncePrice: signal.createdOuncePrice || 0,
      riskFree: signal.riskFree || false,
      lastAiCheckedAt: signal.lastAiCheckedAt,
      lastAiCheckedPrice: signal.lastAiCheckedPrice,
      ownerId: signal.owner ? ((signal.owner as any)._id || (signal.owner as any).id || (signal.owner as any)).toString() : '',
      subscriptions: subsMap,
    });
  }

  @OnEvent(EVENTS.SIGNAL_ACTIVE)
  async handleCacheSignalActive(signal: Signal) {
    const signalIdStr = (signal._id || signal.id).toString();
    const cached = this.signalCache.get(signalIdStr);
    if (cached) {
      this.logger.log(`Cache Sync: Setting signal ${signalIdStr} to ACTIVE`);
      cached.status = SignalStatus.Active;
    }
    await this.notifyFollowers(signal, 'active');
  }

  @OnEvent(EVENTS.SIGNAL_CLOSED)
  async handleCacheSignalClosed(signal: Signal) {
    const signalIdStr = (signal._id || signal.id).toString();
    this.logger.log(`Cache Sync: Removing closed signal ${signalIdStr}`);
    await this.notifyFollowers(signal, 'closed');
    this.signalCache.delete(signalIdStr);
  }

  @OnEvent(EVENTS.SIGNAL_CANCELED)
  async handleCacheSignalCanceled(signal: Signal) {
    const signalIdStr = (signal._id || signal.id).toString();
    this.logger.log(`Cache Sync: Removing canceled signal ${signalIdStr}`);
    await this.notifyFollowers(signal, 'canceled');
    this.signalCache.delete(signalIdStr);
  }

  @OnEvent(EVENTS.SIGNAL_RISK_FREE)
  async handleCacheSignalRiskFree(signal: Signal) {
    const signalIdStr = (signal._id || signal.id).toString();
    const cached = this.signalCache.get(signalIdStr);
    if (cached) {
      this.logger.log(`Cache Sync: Setting signal ${signalIdStr} to riskFree`);
      cached.riskFree = true;
    }
  }

  @OnEvent(EVENTS.SIGNAL_SUBSCRIPTION_UPDATED)
  async handleCacheSubscriptionUpdated(sub: SignalSubscription) {
    const signalIdStr = sub.signal?.toString() || (sub as any).signal?._id?.toString();
    if (!signalIdStr) return;

    const cached = this.signalCache.get(signalIdStr);
    if (cached && sub.user) {
      const userObj = sub.user;
      this.logger.log(`Cache Sync: Updating subscription for user ${userObj._id} on signal ${signalIdStr}`);
      cached.subscriptions.set(userObj._id.toString(), {
        userId: userObj._id.toString(),
        telegramId: userObj.telegramId,
        language: userObj.language || 'fa',
        gem: userObj.gem || 0,
        followStatus: sub.followStatus,
        aiShield: sub.aiShield,
        notifSignalFollow: userObj.notifSignalFollow !== false,
        notifAiShield: userObj.notifAiShield !== false,
      });
    }
  }

  // 3. Main Price Loop: Checks price triggers completely in-memory
  @OnEvent(EVENTS.OUNCE_PRICE_UPDATED)
  async handleOuncePriceUpdated(price: number) {
    if (!price || this.isProcessing) return;

    this.isProcessing = true;
    try {
      for (const [signalId, cachedSignal] of this.signalCache.entries()) {
        
        // A. Handle Pending (کاشته شده) activation check
        if (cachedSignal.status === SignalStatus.Pending) {
          const tempSignal = {
            entryPrice: cachedSignal.entryPrice,
            createdOuncePrice: cachedSignal.createdOuncePrice,
          } as Signal;

          if (Signal.activeTrigger(tempSignal, price)) {
            this.logger.log(`In-Memory Trigger: Signal ${signalId} activated at price ${price}`);
            const signalDb = await this.signalModel.findById(signalId).exec();
            if (signalDb) {
              await this.signalsService.activateSignal(signalDb);
            }
          } else {
            // Evaluate with AI Shield for Pending signals
            const validSubs = Array.from(cachedSignal.subscriptions.values()).filter(
              (sub) => sub.aiShield,
            );

            if (validSubs.length > 0) {
              const lastCheck = cachedSignal.lastAiCheckedAt
                ? new Date(cachedSignal.lastAiCheckedAt).getTime()
                : 0;

              if (Date.now() - lastCheck >= 15 * 60 * 1000) {
                const shouldEvaluate = await this.shouldEvaluateSignal(cachedSignal, price);
                if (shouldEvaluate) {
                  const verifiedSubs: CachedSubscription[] = [];
                  for (const sub of validSubs) {
                    const userDb = await this.userModel.findById(sub.userId).select('gem').exec();
                    const currentGems = userDb?.gem || 0;
                    sub.gem = currentGems;
                    if (currentGems >= 100) {
                      verifiedSubs.push(sub);
                    }
                  }

                  if (verifiedSubs.length > 0) {
                    const signalDb = await this.signalModel.findById(signalId).populate('owner').exec();
                    if (signalDb) {
                      await this.evaluateSignalWithAI(signalDb, price, verifiedSubs);
                    }
                  }
                }
              }
            }
          }
        } 
        
        // B. Handle Active status checks (TP/SL hit & AI Shield)
        else if (cachedSignal.status === SignalStatus.Active) {
          const tempSignal = {
            type: cachedSignal.type,
            isSell: cachedSignal.type === SignalType.Sell,
            riskFree: cachedSignal.riskFree,
            entryPrice: cachedSignal.entryPrice,
            maxPrice: cachedSignal.maxPrice,
            minPrice: cachedSignal.minPrice,
          } as unknown as Signal;

          // Check if TP or SL has been hit
          if (Signal.closeTrigger(tempSignal, price)) {
            this.logger.log(`In-Memory Trigger: Signal ${signalId} hit exit at price ${price}`);
            const signalDb = await this.signalModel.findById(signalId).exec();
            if (signalDb) {
              await this.signalsService.closeSignal(signalDb, price);
            }
          } 
          
          // C. Handle Smart Shield AI Monitoring (Debounced/Rate-limited)
          else {
            const validSubs = Array.from(cachedSignal.subscriptions.values()).filter(
              (sub) => sub.aiShield,
            );

            if (validSubs.length > 0) {
              const lastCheck = cachedSignal.lastAiCheckedAt
                ? new Date(cachedSignal.lastAiCheckedAt).getTime()
                : 0;

              // Check at most once every 15 minutes per signal
              if (Date.now() - lastCheck >= 15 * 60 * 1000) {
                const shouldEvaluate = await this.shouldEvaluateSignal(cachedSignal, price);
                if (shouldEvaluate) {
                  // Fetch and sync latest gem count from database for active subscribers to prevent stale cache issues
                  const verifiedSubs: CachedSubscription[] = [];
                  for (const sub of validSubs) {
                    const userDb = await this.userModel.findById(sub.userId).select('gem').exec();
                    const currentGems = userDb?.gem || 0;
                    // Sync the fresh count to our cache
                    sub.gem = currentGems;
                    if (currentGems >= 100) {
                      verifiedSubs.push(sub);
                    }
                  }

                  if (verifiedSubs.length > 0) {
                    const signalDb = await this.signalModel.findById(signalId).populate('owner').exec();
                    if (signalDb) {
                      await this.evaluateSignalWithAI(signalDb, price, verifiedSubs);
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error in handleOuncePriceUpdated copilot loop:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Pre-filtering check using ATR and cached properties
  private async shouldEvaluateSignal(signal: CachedSignal, currentPrice: number): Promise<boolean> {
    const isSell = signal.type === SignalType.Sell;
    const entryPrice = signal.entryPrice;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const candles5m = await this.candleModel
      .find({ timestamp: { $gte: thirtyDaysAgo } })
      .sort({ timestamp: 1 })
      .exec();

    if (candles5m.length === 0) return true;

    const atr = calculateATR(candles5m, 14);
    const refPrice = signal.lastAiCheckedPrice || entryPrice;
    const priceMove = Math.abs(currentPrice - refPrice);

    // Skip AI calculation if the price hasn't moved significantly (>= 1.5x ATR)
    if (priceMove < 1.5 * atr) {
      return false;
    }

    if (signal.status === SignalStatus.Pending) {
      return true;
    }

    const distanceToTP = isSell ? entryPrice - signal.minPrice : signal.maxPrice - entryPrice;
    const currentProgress = isSell ? entryPrice - currentPrice : currentPrice - entryPrice;

    // If signal is already risk-free, only re-evaluate near TP (>= 80% progress)
    if (signal.riskFree && currentProgress < 0.8 * distanceToTP) {
      return false;
    }

    return true;
  }

  private async evaluateSignalWithAI(signal: Signal, currentPrice: number, subscriptions: CachedSubscription[]) {
    try {
      this.logger.log(`Evaluating signal ${signal._id} with AI Copilot...`);
      const isSell = signal.type === SignalType.Sell;
      const entryPrice = signal.entryPrice;
      const tp = isSell ? signal.minPrice : signal.maxPrice;
      const sl = isSell ? signal.maxPrice : signal.minPrice;

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const candles5m = await this.candleModel
        .find({ timestamp: { $gte: thirtyDaysAgo } })
        .sort({ timestamp: 1 })
        .exec();

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
        const closes5m = candles5m.map((c) => c.close);
        rsi5m = calculateRSI(closes5m, 14);
        sma20_5m = calculateSMA(closes5m, 20);
        atr5m = calculateATR(candles5m, 14);

        const candles15m = aggregateTo15m(candles5m);
        const closes15m = candles15m.map((c) => c.close);
        rsi15m = calculateRSI(closes15m, 14);

        const candles1h = aggregateTo1h(candles5m);
        const closes1h = candles1h.map((c) => c.close);
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

      const alreadyRecommendedRiskFree = signal.aiRecommendations?.some((rec) => rec.type === 'risk_free') || signal.riskFree;

      const promptMessage = `
You are the Smart Shield AI Trading Guard for Ounce24.
You are monitoring a Gold (XAUUSD) signal in real-time.

Signal Status: ${signal.status.toUpperCase()}
- Action Type: ${isSell ? 'SELL' : 'BUY'}
- Entry Price: $${entryPrice.toFixed(2)}
- Current Price: $${currentPrice.toFixed(2)}
- Take Profit (TP): $${tp.toFixed(2)}
- Stop Loss (SL): $${sl.toFixed(2)}
- Volatility (ATR 5m): $${atr5m.toFixed(2)}
- 5m RSI(14): ${rsi5m.toFixed(2)}
- 15m RSI(14): ${rsi15m.toFixed(2)}
- 1h RSI(14): ${rsi1h.toFixed(2)}
- 5m SMA(20): $${sma20_5m.toFixed(2)} (Current price is ${currentPrice > sma20_5m ? 'above' : 'below'} SMA20 by $${Math.abs(currentPrice - sma20_5m).toFixed(2)})
- 1h SMA(20): $${sma20_1h.toFixed(2)}
- 1h SMA(50): $${sma50_1h.toFixed(2)}
- Risk-Free setup already suggested/active: ${alreadyRecommendedRiskFree ? 'YES' : 'NO'}

Recent Price History (4-hour resolution, past 30 days - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory4h}

Recent Price History (1-hour resolution, past 3 days - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory1h}

Recent Price History (15-minute resolution, past 12 hours - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory15m}

Recent Price History (5-minute resolution, past 2 hours - Format: MM-DD HH:mm,Open,High,Low,Close):
${formattedHistory5m}

Instructions:
Evaluate the technical gold chart and indicators to suggest trade adjustments.
- If status is ACTIVE:
  Evaluate whether the user should:
  1. "risk_free": Move SL to Entry (only suggest if price is in decent profit, e.g., >= 1.5x ATR, and it hasn't been done yet).
  2. "extend_tp": Move TP higher (for BUY) or lower (for SELL) because momentum is extremely strong in the trade direction.
  3. "early_exit": Close the trade immediately at current market price because the trend has clearly reversed and keeping the trade is highly risky.
  4. "trailing_sl": Lock in profit by moving SL further into profit territory.
  5. "none": No change needed. Just keep the trade running as is.
- If status is PENDING:
  Evaluate whether the user should:
  1. "cancel": Cancel the pending order immediately because the market structure/trend has changed significantly and the setup is no longer valid or has high risk.
  2. "none": Keep the pending order as is.

Return your response ONLY as a valid JSON object matching the following TypeScript interface (do NOT include any markdown code blocks, backticks, or other text):
{
  "recommendation": "risk_free" | "trailing_sl" | "extend_tp" | "early_exit" | "cancel" | "none",
  "price": number, // suggest the exact price level if recommendation is extend_tp or trailing_sl, otherwise current price or 0
  "messageFa": "Persian instruction message to the trader, clear, blunt and decisive. e.g. 'طلا مقاومت کلیدی فلان را با شتاب شکسته است؛ حد سود را به ۲۳۶۰ افزایش دهید.'",
  "messageEn": "English version of the message"
}
`;

      const result = await this.aiChatService.createResponse(promptMessage, 'fa');

      let cleanText = result.text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }

      const copilotResponse = JSON.parse(cleanText);
      const recommendationType = copilotResponse.recommendation;

      if (!recommendationType || recommendationType === 'none') {
        await this.signalModel.findByIdAndUpdate(signal._id, {
          lastAiCheckedAt: new Date(),
          lastAiCheckedPrice: currentPrice,
        });

        // Update in-memory cache timestamps
        const cached = this.signalCache.get(signal._id.toString());
        if (cached) {
          cached.lastAiCheckedAt = new Date();
          cached.lastAiCheckedPrice = currentPrice;
        }
        return;
      }

      const newRec = {
        type: recommendationType,
        price: copilotResponse.price || currentPrice,
        message: copilotResponse.messageFa,
        applied: false,
        createdAt: new Date(),
      };

      await this.signalModel.findByIdAndUpdate(signal._id, {
        $push: { aiRecommendations: newRec },
        lastAiCheckedAt: new Date(),
        lastAiCheckedPrice: currentPrice,
      });

      // Update in-memory cache timestamps
      const cached = this.signalCache.get(signal._id.toString());
      if (cached) {
        cached.lastAiCheckedAt = new Date();
        cached.lastAiCheckedPrice = currentPrice;
      }

      // Dispatch notifications to subscribers
      for (const sub of subscriptions) {
        // Double check gems in cache (requires 3 gems now)
        if (sub.gem < 100) continue;
        // Skip if user has disabled AI Shield notifications
        if (!sub.notifAiShield) continue;

        const isPersonal = signal.owner && (
          (signal.owner as any)._id?.toString() === sub.userId || 
          (signal.owner as any).id?.toString() === sub.userId || 
          signal.owner.toString() === sub.userId
        );

        const lang = sub.language || 'fa';
        const message = lang === 'fa' ? copilotResponse.messageFa : copilotResponse.messageEn;
        const t = getTranslation(lang);
        const alertTitle = `🛡️ ${t.pushNotifications.aiShieldTitle}`;

        // 1. Send via WebPush (Disabled - Telegram active)
        /*
        const pushPayload = JSON.stringify({
          title: alertTitle,
          body: `${message}\n\nPrice: $${currentPrice.toFixed(2)}`,
          icon: '/assets/icons/icon-192x192.png',
          data: { url: `/signals/${signal._id}` },
        });
        await this.webPushService.sendNotificationToUser(sub.userId, pushPayload);
        */

        // 2. Send via Telegram Bot
        if (sub.telegramId) {
          const signalInfo = formatSignalDetails(signal, lang);
          const telegramMessage = `🛡️ <b>${alertTitle}</b>\n\n${message}\n\n💵 Price: <b>$${currentPrice.toFixed(2)}</b>\n\n${signalInfo}`;
          
          const targetPrice = copilotResponse.price || currentPrice || 0;
          const inlineKeyboard = isPersonal 
            ? getCopilotInlineKeyboard(recommendationType, signal._id.toString(), targetPrice, lang)
            : undefined;

          await this.bot.telegram
            .sendMessage(sub.telegramId, telegramMessage, {
              parse_mode: 'HTML',
              reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined,
            })
            .catch((err) => {
              this.logger.error(`Failed to send Telegram message to user ${sub.userId}:`, err);
            });
        }

        // 3. Deduct 3 Gems
        await this.userModel.findByIdAndUpdate(sub.userId, { $inc: { gem: -3 } }).exec();

        // 4. Log Gem deduction
        await this.gemLogModel.create({
          user: sub.userId,
          gemsChange: -3,
          gemsBefore: sub.gem,
          gemsAfter: sub.gem - 3,
          action: GemLogAction.SignalAnalyze,
        });

        // 5. Deduct from local cache gem count
        sub.gem = sub.gem - 3;
      }
    } catch (error) {
      this.logger.error(`Error in evaluateSignalWithAI for signal ${signal._id}:`, error);
    }
  }

  // Handle follow notifications
  private async notifyFollowers(signal: Signal, state: 'active' | 'closed' | 'canceled') {
    try {
      const signalIdStr = (signal.id || (signal as any)._id).toString();
      const cached = this.signalCache.get(signalIdStr);
      if (!cached) return;

      const populatedSignal = await this.signalModel
        .findById(signalIdStr)
        .populate('owner')
        .exec();

      if (!populatedSignal) return;

      for (const sub of cached.subscriptions.values()) {
        if (!sub.followStatus) continue;
        // Skip if user has disabled signal-follow notifications
        if (!sub.notifSignalFollow) continue;

        const lang = sub.language || 'fa';
        const t = getTranslation(lang);
        const typeStr = populatedSignal.type === SignalType.Buy ? t.pushNotifications.buy : t.pushNotifications.sell;
        const entryPrice = populatedSignal.entryPrice;

        let message = '';
        if (state === 'active') {
          message = t.pushNotifications.signalActive(typeStr, entryPrice.toFixed(2));
        } else if (state === 'closed') {
          const profitPip = populatedSignal.pip !== null ? populatedSignal.pip : 0;
          const pipStr = profitPip >= 0 ? `+${profitPip} pip` : `${profitPip} pip`;
          message = t.pushNotifications.signalClosed(typeStr, pipStr);
        } else if (state === 'canceled') {
          message = t.pushNotifications.signalCanceled(typeStr);
        }

        const title = `📢 ${t.pushNotifications.signalStatusTitle}`;

        // 1. WebPush (Disabled - Telegram active)
        /*
        const pushPayload = JSON.stringify({
          title,
          body: message,
          icon: '/assets/icons/icon-192x192.png',
          data: { url: `/signals/${signalIdStr}` },
        });
        await this.webPushService.sendNotificationToUser(sub.userId, pushPayload);
        */

        // 2. Telegram Bot
        if (sub.telegramId) {
          const signalInfo = formatSignalDetails(populatedSignal, lang);
          const telegramMessage = `📢 <b>${title}</b>\n\n${message}\n\n${signalInfo}`;
          await this.bot.telegram
            .sendMessage(sub.telegramId, telegramMessage, {
              parse_mode: 'HTML',
            })
            .catch((err) => {
              this.logger.error(`Failed to send follower Telegram alert to user ${sub.userId}:`, err);
            });
        }
      }
    } catch (error) {
      this.logger.error('Error notifying followers of status change:', error);
    }
  }
}

// Technical calculations
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
  return 100 - 100 / (1 + rs);
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

function getCopilotInlineKeyboard(
  recommendationType: string,
  signalId: string,
  price: number,
  lang: string,
) {
  const t = getTranslation(lang);
  if (recommendationType === 'risk_free') {
    return [
      [
        {
          text: t.pushNotifications.makeRiskFree,
          callback_data: `risk_free_${signalId}`,
        },
      ],
    ];
  }
  if (recommendationType === 'early_exit') {
    return [
      [
        {
          text: t.pushNotifications.closeSignal,
          callback_data: `close_signal_${signalId}`,
        },
      ],
    ];
  }
  if (recommendationType === 'cancel') {
    return [
      [
        {
          text: t.pushNotifications.cancelSignal,
          callback_data: `remove_signal_${signalId}`,
        },
      ],
    ];
  }
  if (recommendationType === 'extend_tp') {
    return [
      [
        {
          text: t.pushNotifications.applyNewTp(price.toFixed(2)),
          callback_data: `apply_tp_${signalId}_${price}`,
        },
      ],
    ];
  }
  if (recommendationType === 'trailing_sl') {
    return [
      [
        {
          text: t.pushNotifications.applyNewSl(price.toFixed(2)),
          callback_data: `apply_sl_${signalId}_${price}`,
        },
      ],
    ];
  }
  return undefined;
}

function formatSignalDetails(signal: Signal, lang: string): string {
  const t = getTranslation(lang);
  const typeStr = signal.type === SignalType.Buy ? t.pushNotifications.buy : t.pushNotifications.sell;
  
  const sl = signal.type === SignalType.Sell ? signal.maxPrice : signal.minPrice;
  const tp = signal.type === SignalType.Sell ? signal.minPrice : signal.maxPrice;

  let details = `📊 <b>${typeStr} Signal Details</b>\n` +
         `🔹 ${t.pushNotifications.entryPrice}: <b>$${signal.entryPrice.toFixed(2)}</b>\n` +
         `🛑 ${t.pushNotifications.stopLoss}: <b>$${sl.toFixed(2)}</b>\n` +
         `🎯 ${t.pushNotifications.takeProfit}: <b>$${tp.toFixed(2)}</b>`;

  if (signal.owner && (signal.owner as any).tag) {
    details += `\n👤 ${t.pushNotifications.owner}: <b>${(signal.owner as any).tag}</b>`;
  }

  return details;
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
