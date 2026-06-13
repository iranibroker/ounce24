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
  Follow,
} from '@ounce24/types';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import { EVENTS } from '../consts';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { AiOrchestratorService } from '../ai/ai-orchestrator.service';
import { WebPushService } from '../web-push/web-push.service';
import { SignalsService, getStyleInstructions } from './signals.service';
import { getTranslation } from '../bot/i18n';
import { analyzeMarketState, detectTradingStyle, buildMarketContextJson } from './market-analyzer.helper';

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
    @InjectModel(Follow.name)
    private readonly followModel: Model<Follow>,
    @InjectModel(GemLog.name) private readonly gemLogModel: Model<GemLog>,
    @InjectModel(OuncePriceCandle.name)
    private readonly candleModel: Model<OuncePriceCandle>,
    private readonly ouncePriceService: OuncePriceService,
    private readonly aiOrchestratorService: AiOrchestratorService,
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
      ownerId: signal.owner ? ((signal.owner as any)._id || (signal.owner as any).id || (signal.owner as any)).toString() : '',
      subscriptions: subsMap,
    });

    await this.notifyFollowersOnSignalCreated(signal);
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

      // Fetch external index prices and news
      const dxyData = await this.signalsService.getCachedYahooPriceAndChange('DX-Y.NYB');
      const us10yData = await this.signalsService.getCachedYahooPriceAndChange('^TNX');
      
      const newsCheck = await this.signalsService.isNearHighImpactUSDNews();

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
        const risk = RiskTolerance.Moderate;
        const key = `${risk}`;
        if (!groups.has(key)) {
          groups.set(key, { style, risk, subs: [] });
        }
        groups.get(key)!.subs.push(sub);
      }

      for (const [key, group] of groups.entries()) {
        const result = await this.aiOrchestratorService.evaluateCopilot(
          signal,
          currentPrice,
          marketState,
          { tradingStyle: group.style, riskTolerance: group.risk },
          marketContextJson
        );

        const copilotResponse = result.data;
        const recommendationType = copilotResponse.recommendation;

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

  // Handle new signal notifications to followers of the signal owner
  private async notifyFollowersOnSignalCreated(signal: Signal) {
    try {
      const signalIdStr = (signal.id || (signal as any)._id).toString();
      const ownerId = signal.owner ? ((signal.owner as any)._id || (signal.owner as any).id || signal.owner).toString() : '';
      if (!ownerId) return;

      const ownerObj = signal.owner as any;
      let traderName = ownerObj?.title || ownerObj?.name || '';
      if (!traderName) {
        const ownerDb = await this.userModel.findById(ownerId).exec();
        traderName = ownerDb?.title || ownerDb?.name || 'یک کاربر';
      }

      const follows = await this.followModel.find({ following: ownerId }).populate('follower').exec();

      for (const follow of follows) {
        const follower = follow.follower as any;
        if (!follower) continue;
        if (follower.notifSignalFollow === false) continue;

        const lang = follower.language || 'fa';
        const t = getTranslation(lang);
        const typeStr = signal.type === SignalType.Buy ? t.pushNotifications.buy : t.pushNotifications.sell;

        const title = `📢 ${t.pushNotifications.signalStatusTitle}`;
        const message = t.pushNotifications.signalCreatedByFollowing(traderName, typeStr);

        if (follower.telegramId) {
          const signalInfo = formatSignalDetails(signal, lang);
          const telegramMessage = `📢 <b>${title}</b>\n\n${message}\n\n${signalInfo}`;
          await this.bot.telegram
            .sendMessage(follower.telegramId, telegramMessage, {
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
              this.logger.error(`Failed to send signal-created Telegram alert to follower user ${follower._id}:`, err);
            });
        }
      }
    } catch (error) {
      this.logger.error('Error notifying followers on signal creation:', error);
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
