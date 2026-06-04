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
    this.signalCache.delete(signalIdStr);
    await this.notifyFollowers(signal, 'closed');
  }

  @OnEvent(EVENTS.SIGNAL_CANCELED)
  async handleCacheSignalCanceled(signal: Signal) {
    const signalIdStr = (signal._id || signal.id).toString();
    this.logger.log(`Cache Sync: Removing canceled signal ${signalIdStr}`);
    this.signalCache.delete(signalIdStr);
    await this.notifyFollowers(signal, 'canceled');
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

      let formattedHistory5m = 'No historical data available.';
      let rsi5m = 50;
      let sma20_5m = currentPrice;
      let atr5m = 1.5;

      if (candles5m.length > 0) {
        const closes5m = candles5m.map((c) => c.close);
        rsi5m = calculateRSI(closes5m, 14);
        sma20_5m = calculateSMA(closes5m, 20);
        atr5m = calculateATR(candles5m, 14);

        const formatCandle = (c: any) => {
          const dateStr = new Date(c.timestamp).toISOString().replace('T', ' ').substring(5, 16);
          return `${dateStr},${c.open.toFixed(2)},${c.high.toFixed(2)},${c.low.toFixed(2)},${c.close.toFixed(2)}`;
        };
        formattedHistory5m = candles5m.slice(-36).map(formatCandle).join('\n');
      }

      const alreadyRecommendedRiskFree = signal.aiRecommendations?.some((rec) => rec.type === 'risk_free') || signal.riskFree;

      const promptMessage = `
You are the Smart Shield AI Trading Guard for Ounce24.
You are monitoring an ACTIVE Gold (XAUUSD) signal in real-time.
Your goal is to suggest dynamic trade adjustments to maximize profits or mitigate risks.

Signal Status: ACTIVE
- Action Type: ${isSell ? 'SELL' : 'BUY'}
- Entry Price: $${entryPrice.toFixed(2)}
- Current Price: $${currentPrice.toFixed(2)}
- Take Profit (TP): $${tp.toFixed(2)}
- Stop Loss (SL): $${sl.toFixed(2)}
- Volatility (ATR 5m): $${atr5m.toFixed(2)}
- 5m RSI(14): ${rsi5m.toFixed(2)}
- 5m SMA(20): $${sma20_5m.toFixed(2)}
- Risk-Free setup already suggested/active: ${alreadyRecommendedRiskFree ? 'YES' : 'NO'}

Recent 5m Price History:
${formattedHistory5m}

Instructions:
Evaluate whether the user should:
1. "risk_free": Move SL to Entry (only suggest if price is in decent profit, e.g., >= 1.5x ATR, and it hasn't been done yet).
2. "extend_tp": Move TP higher (for BUY) or lower (for SELL) because momentum is extremely strong in the trade direction.
3. "early_exit": Close the trade immediately at current market price because the trend has clearly reversed and keeping the trade is highly risky.
4. "trailing_sl": Lock in profit by moving SL further into profit territory.
5. "none": No change needed. Just keep the trade running as is.

Return your response ONLY as a valid JSON object matching the following TypeScript interface (do NOT include any markdown code blocks, backticks, or other text):
{
  "recommendation": "risk_free" | "trailing_sl" | "extend_tp" | "early_exit" | "none",
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
        // Double check gems in cache
        if (sub.gem < 100) continue;
        // Skip if user has disabled AI Shield notifications
        if (!sub.notifAiShield) continue;

        const lang = sub.language || 'fa';
        const message = lang === 'fa' ? copilotResponse.messageFa : copilotResponse.messageEn;
        const t = getTranslation(lang);
        const alertTitle = `🛡️ ${t.pushNotifications.aiShieldTitle}`;

        // 1. Send via WebPush
        const pushPayload = JSON.stringify({
          title: alertTitle,
          body: `${message}\n\nPrice: $${currentPrice.toFixed(2)}`,
          icon: '/assets/icons/icon-192x192.png',
          data: { url: `/signals/${signal._id}` },
        });
        await this.webPushService.sendNotificationToUser(sub.userId, pushPayload);

        // 2. Send via Telegram Bot (Temporarily disabled - only push notification active)
        /*
        if (sub.telegramId) {
          const telegramMessage = `🛡️ <b>${alertTitle}</b>\n\n${message}\n\n💵 Price: <b>$${currentPrice.toFixed(2)}</b>\n\n🔗 <a href="https://app.ounce24.com/signals/${signal._id}">View Signal Detail</a>`;
          await this.bot.telegram
            .sendMessage(sub.telegramId, telegramMessage, {
              parse_mode: 'HTML',
            })
            .catch((err) => {
              this.logger.error(`Failed to send Telegram message to user ${sub.userId}:`, err);
            });
        }
        */

        // 3. Deduct 1 Gem
        await this.userModel.findByIdAndUpdate(sub.userId, { $inc: { gem: -1 } }).exec();

        // 4. Log Gem deduction
        await this.gemLogModel.create({
          user: sub.userId,
          gemsChange: -1,
          gemsBefore: sub.gem,
          gemsAfter: sub.gem - 1,
          action: GemLogAction.SignalAnalyze,
        });

        // 5. Deduct from local cache gem count
        sub.gem = sub.gem - 1;
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

      for (const sub of cached.subscriptions.values()) {
        if (!sub.followStatus) continue;
        // Skip if user has disabled signal-follow notifications
        if (!sub.notifSignalFollow) continue;

        const lang = sub.language || 'fa';
        const t = getTranslation(lang);
        const typeStr = signal.type === SignalType.Buy ? t.pushNotifications.buy : t.pushNotifications.sell;
        const entryPrice = signal.entryPrice;

        let message = '';
        if (state === 'active') {
          message = t.pushNotifications.signalActive(typeStr, entryPrice.toFixed(2));
        } else if (state === 'closed') {
          const profitPip = signal.pip !== null ? signal.pip : 0;
          const pipStr = profitPip >= 0 ? `+${profitPip} pip` : `${profitPip} pip`;
          message = t.pushNotifications.signalClosed(typeStr, pipStr);
        } else if (state === 'canceled') {
          message = t.pushNotifications.signalCanceled(typeStr);
        }

        const title = `📢 ${t.pushNotifications.signalStatusTitle}`;

        // 1. WebPush
        const pushPayload = JSON.stringify({
          title,
          body: message,
          icon: '/assets/icons/icon-192x192.png',
          data: { url: `/signals/${signalIdStr}` },
        });
        await this.webPushService.sendNotificationToUser(sub.userId, pushPayload);

        // 2. Telegram Bot (Temporarily disabled - only push notification active)
        /*
        if (sub.telegramId) {
          const telegramMessage = `📢 <b>${title}</b>\n\n${message}\n\n🔗 <a href="https://app.ounce24.com/signals/${signalIdStr}">View Signal Detail</a>`;
          await this.bot.telegram
            .sendMessage(sub.telegramId, telegramMessage, {
              parse_mode: 'HTML',
            })
            .catch((err) => {
              this.logger.error(`Failed to send follower Telegram alert to user ${sub.userId}:`, err);
            });
        }
        */
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
