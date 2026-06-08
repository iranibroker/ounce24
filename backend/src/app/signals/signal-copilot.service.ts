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
  TradingStyle,
  RiskTolerance,
} from '@ounce24/types';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import { EVENTS } from '../consts';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { AiChatService } from '../ai-chat/ai-chat.service';
import { WebPushService } from '../web-push/web-push.service';
import { SignalsService, getStyleInstructions } from './signals.service';
import { getTranslation } from '../bot/i18n';
import { analyzeMarketState, detectTradingStyle } from './market-analyzer.helper';

const APP_URL = process.env.APP_URL || 'https://app.ounce24.com';

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
  tradingStyle?: TradingStyle;
  riskTolerance?: RiskTolerance;
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
              tradingStyle: userObj.tradingStyle,
              riskTolerance: userObj.riskTolerance,
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
          tradingStyle: userObj.tradingStyle,
          riskTolerance: userObj.riskTolerance,
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
        tradingStyle: userObj.tradingStyle,
        riskTolerance: userObj.riskTolerance,
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
                    if (currentGems >= 20) {
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
                    if (currentGems >= 20) {
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

      if (candles5m.length === 0) return;

      const marketState = analyzeMarketState(currentPrice, candles5m);

      const alreadyRecommendedRiskFree = signal.aiRecommendations?.some((rec) => rec.type === 'risk_free') || signal.riskFree;

      const ownerId = signal.owner ? ((signal.owner as any)._id || (signal.owner as any).id || (signal.owner as any)).toString() : '';

      // Group active subscriptions by their unique riskTolerance (tradingStyle is auto-detected per signal)
      const targetDistance = Math.abs(tp - entryPrice);
      const style = detectTradingStyle(targetDistance, marketState.atr1h);

      const groups = new Map<string, {
        style: TradingStyle;
        risk: RiskTolerance;
        subs: CachedSubscription[];
      }>();

      for (const sub of subscriptions) {
        const risk = sub.riskTolerance || RiskTolerance.Moderate;
        const key = `${risk}`;
        if (!groups.has(key)) {
          groups.set(key, { style, risk, subs: [] });
        }
        groups.get(key)!.subs.push(sub);
      }

      for (const [key, group] of groups.entries()) {
        const styleInstructions = getStyleInstructions(group.style, group.risk);

        const promptMessage = `
Smart Shield AI Guard for Ounce24. Monitor this Gold (XAUUSD) signal in real-time.

Signal: ${isSell ? 'SELL' : 'BUY'} | Status: ${signal.status.toUpperCase()} | Entry: $${entryPrice.toFixed(2)} | Current: $${currentPrice.toFixed(2)} | TP: $${tp.toFixed(2)} | SL: $${sl.toFixed(2)} | Risk-Free: ${alreadyRecommendedRiskFree ? 'YES' : 'NO'}

Market State:
${marketState.semanticText}

${styleInstructions}

Recommendations (pick ONE):
ACTIVE signals: "risk_free" (move SL to entry, only if profit >= 1.5x ATR and not already done), "extend_tp" (strong momentum continues), "early_exit" (trend clearly reversed), "trailing_sl" (lock profit), "none" (no change).
PENDING signals: "cancel" (setup invalidated by market change), "none" (keep as is).

CORE SCIENTIFIC & TECHNICAL EVALUATION RULES:

1. Support & Resistance (S/R) and SMC Zones (Order Blocks, FVG) Logic:
   - For a BUY signal:
     * Support levels, bullish Order Blocks, and bullish FVGs *below* the entryPrice are protective features. They act as floors safeguarding the Stop Loss.
     * Resistance levels, bearish Order Blocks, and bearish FVGs *above* the entryPrice act as key obstacles. If a resistance level lies between the entryPrice and Take Profit (TP), it represents a major obstacle that can block the trade. This is a negative feature.
   - For a SELL signal:
     * Resistance levels, bearish Order Blocks, and bearish FVGs *above* the entryPrice are protective features. They act as ceilings safeguarding the Stop Loss.
     * Support levels, bullish Order Blocks, and bullish FVGs *below* the entryPrice act as key obstacles. If a support level lies between the entryPrice and Take Profit (TP), it represents a major obstacle that can block the trade. This is a negative feature.

2. Pending Order Projection (Status = PENDING):
   - A pending limit order is waiting for the price to pull back/retrace to the entryPrice. Retracements are normal and expected. Do not recommend "cancel" simply because the price moves towards the entryPrice (e.g. short-term bearish pullback for a BUY limit, or short-term bullish pullback for a SELL limit).
   - Simulate the trade path starting FROM the entryPrice, NOT the currentPrice. Check for blocking S/R levels strictly between the entryPrice and the Take Profit.
   - Recommend "cancel" ONLY if:
     * The price has touched/crossed the Take Profit (TP) level ($${tp.toFixed(2)}) without first triggering the entryPrice.
     * The price has broken past the Stop Loss (SL) level ($${sl.toFixed(2)}) or a major S/R level backing the entry before activation.
     * The entryPrice has become completely unreachable (e.g., price has moved away from the entryPrice by more than 3.0x ATR of the core timeframe).
     * A major structural market trend change occurs that invalidates the setup structure.

3. Active Signal Management Rules (Status = ACTIVE):
   - Recommend "early_exit" (exit at current market price $${currentPrice.toFixed(2)}) if:
     * The price breaks a critical trend level or SMA50 in the opposite direction with high momentum.
     * A strong opposing Order Block or FVG has formed between the current price and TP, showing signs of price rejection.
     * For BUY: Price shows clear rejection at a major resistance level, and momentum is reversing (RSI falling below 50).
     * For SELL: Price shows clear rejection at a major support level, and momentum is reversing (RSI rising above 50).
   - Recommend "risk_free" (move Stop Loss to entryPrice) if:
     * The trade is currently in profit by at least 1.5x of the core ATR, and the trade is not already marked as Risk-Free.
   - Recommend "trailing_sl" if:
     * The trade has completed at least 50% of the progress from entryPrice to TP.
     * There is a newly formed swing point or SMA20/50 level that can act as a technical trailing stop (supports for BUY, resistances for SELL). Specify the new SL price level in the "price" field.
   - Recommend "extend_tp" if:
     * The trade moves strongly in our favor with high momentum, with no overhead S/R barriers or fresh opposing Order Blocks until a much further price level. Specify the new TP price level in the "price" field.

4. Target Sanity Check:
   - Verify the distance between entryPrice and TP. If it exceeds 5.0x the core timeframe's ATR (5m ATR for Scalping, 1h ATR for Day/Swing), penalize the setup heavily as being highly unrealistic.

Return ONLY a valid JSON object (no markdown, no backticks, no comments):
{"recommendation":"risk_free"|"trailing_sl"|"extend_tp"|"early_exit"|"cancel"|"none","price":number,"messageFa":"...","messageEn":"...","messageAr":"...","messageTr":"..."}
`;

        const result = await this.aiChatService.createResponse(promptMessage, 'fa', { temperature: 0.1 });

        let cleanText = result.text.trim();
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        }

        let copilotResponse: any = null;
        try {
          copilotResponse = JSON.parse(cleanText);
        } catch (e) {
          this.logger.error(`Failed to parse AI Shield response JSON: ${cleanText}`);
          continue;
        }

        const recommendationType = copilotResponse?.recommendation;

        if (!recommendationType || recommendationType === 'none') {
          continue;
        }

        // If this group contains the signal owner, we push the recommendation to the database
        const isOwnerGroup = group.subs.some((sub) => sub.userId === ownerId);
        if (isOwnerGroup) {
          const newRec = {
            type: recommendationType,
            price: copilotResponse.price || currentPrice,
            message: copilotResponse.messageFa,
            applied: false,
            createdAt: new Date(),
          };

          await this.signalModel.findByIdAndUpdate(signal._id, {
            $push: { aiRecommendations: newRec },
          });
        }

        // Dispatch notifications to subscribers in this group
        for (const sub of group.subs) {
          if (sub.gem < 20) continue;
          if (!sub.notifAiShield) continue;

          const isPersonal = signal.owner && (
            (signal.owner as any)._id?.toString() === sub.userId || 
            (signal.owner as any).id?.toString() === sub.userId || 
            signal.owner.toString() === sub.userId
          );

          const lang = sub.language || 'fa';
          
          let message = copilotResponse.messageEn;
          if (lang === 'fa') {
            message = copilotResponse.messageFa;
          } else if (lang === 'ar') {
            message = copilotResponse.messageAr || copilotResponse.messageEn;
          } else if (lang === 'tr') {
            message = copilotResponse.messageTr || copilotResponse.messageEn;
          }

          const t = getTranslation(lang);
          const alertTitle = `🛡️ ${t.pushNotifications.aiShieldTitle}`;

          if (sub.telegramId) {
            const signalInfo = formatSignalDetails(signal, lang);
            const telegramMessage = `🛡️ <b>${alertTitle}</b>\n\n${message}\n\n${signalInfo}\n\n💵 XAUUSD: <b>${currentPrice.toFixed(2)}</b>`;
            
            await this.bot.telegram
              .sendMessage(sub.telegramId, telegramMessage, {
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: t.pushNotifications.viewAndApply,
                        web_app: { url: `${APP_URL}/signals/${signal._id.toString()}` },
                      },
                    ],
                  ],
                },
              })
              .catch((err) => {
                this.logger.error(`Failed to send Telegram message to user ${sub.userId}:`, err);
              });
          }

          // Deduct 1 Gems
          await this.userModel.findByIdAndUpdate(sub.userId, { $inc: { gem: -1 } }).exec();

          // Log Gem deduction
          await this.gemLogModel.create({
            user: sub.userId,
            gemsChange: -1,
            gemsBefore: sub.gem,
            gemsAfter: sub.gem - 1,
            action: GemLogAction.SignalAnalyze,
          });

          sub.gem = sub.gem - 1;
        }
      }

      // Always update last checked timestamps on the signal document and cache
      await this.signalModel.findByIdAndUpdate(signal._id, {
        lastAiCheckedAt: new Date(),
        lastAiCheckedPrice: currentPrice,
      });

      const cached = this.signalCache.get(signal._id.toString());
      if (cached) {
        cached.lastAiCheckedAt = new Date();
        cached.lastAiCheckedPrice = currentPrice;
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

      const ownerId = populatedSignal.owner ? ((populatedSignal.owner as any)._id || (populatedSignal.owner as any).id || populatedSignal.owner).toString() : '';

      for (const sub of cached.subscriptions.values()) {
        if (sub.userId === ownerId) continue;
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
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: t.pushNotifications.viewAndApply,
                      web_app: { url: `${APP_URL}/signals/${signalIdStr}` },
                    },
                  ],
                ],
              },
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

export function formatSignalDetails(signal: Signal, lang: string): string {
  const typeStr = signal.type;
  
  const sl = signal.type === SignalType.Sell ? signal.maxPrice : signal.minPrice;
  const tp = signal.type === SignalType.Sell ? signal.minPrice : signal.maxPrice;

  let details = '';
  if (signal.owner && (signal.owner as any).tag) {
    details += `👤 <b>${(signal.owner as any).tag}</b>\n\n`;
  }

  const typeEmoji = typeStr === 'BUY' ? '🟢' : '🔴';
  const statusStr = signal.status ? signal.status.charAt(0).toUpperCase() + signal.status.slice(1).toLowerCase() : '';

  details += `${typeEmoji} <b>${typeStr}</b>\n` +
         `Entry Price: <b>$${signal.entryPrice.toFixed(2)}</b>\n` +
         `TP: <b>$${tp.toFixed(2)}</b>\n` +
         `SL: <b>$${sl.toFixed(2)}</b>\n` +
         `Status: <b>${statusStr}</b>`;

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
