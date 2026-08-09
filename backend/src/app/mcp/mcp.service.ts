import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import {
  User,
  Signal,
  AiEvaluation,
  SignalAnalyze,
  GemLog,
  OctopusPrediction,
  Podcast,
  Achievement,
  OuncePriceCandle,
  SignalSubscription,
  Follow,
} from '@ounce24/types';
import { PushSubscription } from '../schemas/push-subscription.schema';

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Signal.name) private readonly signalModel: Model<Signal>,
    @InjectModel(AiEvaluation.name) private readonly aiEvaluationModel: Model<AiEvaluation>,
    @InjectModel(SignalAnalyze.name) private readonly signalAnalyzeModel: Model<SignalAnalyze>,
    @InjectModel(GemLog.name) private readonly gemLogModel: Model<GemLog>,
    @InjectModel(OctopusPrediction.name) private readonly octopusPredictionModel: Model<any>,
    @InjectModel(PushSubscription.name) private readonly pushSubscriptionModel: Model<PushSubscription>,
    @InjectModel(Podcast.name) private readonly podcastModel: Model<Podcast>,
    @InjectModel(Achievement.name) private readonly achievementModel: Model<Achievement>,
    @InjectModel(OuncePriceCandle.name) private readonly ouncePriceCandleModel: Model<OuncePriceCandle>,
    @InjectModel(SignalSubscription.name) private readonly signalSubscriptionModel: Model<SignalSubscription>,
    @InjectModel(Follow.name) private readonly followModel: Model<Follow>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  getToolsList() {
    return [
      {
        name: 'get_database_summary',
        description:
          'دریافت خلاصه جامع از تمام ۱۲ کالکشن دیتابیس Ounce24: تعداد اسناد، نام کالکشن‌ها، حجم دیتابیس (مگابایت)، حجم اندیس‌ها و وضعیت سلامت دیتابیس.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_users_list',
        description:
          'دریافت لیست و فیلتر پیشرفته کاربران Ounce24 بر اساس بازه تاریخ ثبت‌نام (fromDate, toDate)، بازه تاریخ ارسال سیگنال توسط کاربر (signalFromDate, signalToDate)، حداقل/حداکثر تعداد سیگنال (minSignals, maxSignals)، حداقل/حداکثر امتیاز (minScore, maxScore)، حداقل/حداکثر وین‌ریت (minWinRate, maxWinRate)، کانال احراز هویت (sources)، و صفحه‌بندی (skip, take).',
        inputSchema: {
          type: 'object',
          properties: {
            fromDate: {
              type: 'string',
              description: 'تاریخ شروع ثبت‌نام کاربر به فرمت ISO 8601 (مثال: 2026-01-01T00:00:00.000Z)',
            },
            toDate: {
              type: 'string',
              description: 'تاریخ پایان ثبت‌نام کاربر به فرمت ISO 8601',
            },
            signalFromDate: {
              type: 'string',
              description: 'فیلتر کاربرانی که از این تاریخ به بعد حداقل یک سیگنال ثبت کرده‌اند',
            },
            signalToDate: {
              type: 'string',
              description: 'فیلتر کاربرانی که تا این تاریخ سیگنال ثبت کرده‌اند',
            },
            minSignals: {
              type: 'number',
              description: 'حداقل تعداد کل سیگنال‌های ثبت شده توسط کاربر',
            },
            maxSignals: {
              type: 'number',
              description: 'حداکثر تعداد سیگنال‌های ثبت شده توسط کاربر',
            },
            minScore: {
              type: 'number',
              description: 'حداقل امتیاز کل کاربر (totalScore)',
            },
            maxScore: {
              type: 'number',
              description: 'حداکثر امتیاز کل کاربر (totalScore)',
            },
            minWinRate: {
              type: 'number',
              description: 'حداقل درصد وین‌ریت کاربر (بین ۰ تا ۱۰۰)',
            },
            maxWinRate: {
              type: 'number',
              description: 'حداکثر درصد وین‌ریت کاربر (بین ۰ تا ۱۰۰)',
            },
            sources: {
              type: 'array',
              items: { type: 'string', enum: ['telegram', 'google', 'phone', 'bitbots'] },
              description: 'آرایه‌ای از سورس‌های ثبت‌نام/احراز هویت (مثال: ["telegram", "google"])',
            },
            hasPushSubscribed: {
              type: 'boolean',
              description: 'فیلتر کاربرانی که نوتیفیکیشن وب‌پوش فعال دارند',
            },
            language: {
              type: 'string',
              description: 'زبان کاربر (مثال: "fa" یا "en")',
            },
            sortBy: {
              type: 'string',
              enum: ['totalScore', 'score', 'winRate', 'totalSignals', 'createdAt', 'gem'],
              description: 'فیلد مرتب‌سازی لیست کاربران (پیش‌فرض totalScore)',
            },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'جهت مرتب‌سازی (پیش‌فرض desc)',
            },
            skip: {
              type: 'number',
              description: 'تعداد رکوردهایی که برای صفحه‌بندی باید صرف‌نظر شوند (پیش‌فرض ۰)',
            },
            take: {
              type: 'number',
              description: 'تعداد رکوردهای خروجی در هر صفحه (پیش‌فرض ۵۰، حداکثر ۲۰۰)',
            },
          },
        },
      },
      {
        name: 'get_user_analytics',
        description:
          'تحلیل آماری و نموداری کاربران: بررسی سورس‌های ورود (تلگرام، گوگل، پیامک OTP، بیت‌بات)، آمار نوتیف‌ها، و روند رشد ثبت‌نام کاربران در بازه تاریخ مشخص (fromDate تا toDate).',
        inputSchema: {
          type: 'object',
          properties: {
            fromDate: {
              type: 'string',
              description: 'تاریخ شروع تحلیل کاربران ISO',
            },
            toDate: {
              type: 'string',
              description: 'تاریخ پایان تحلیل کاربران ISO',
            },
            groupBy: {
              type: 'string',
              enum: ['source', 'language', 'date', 'none'],
              description: 'نحوه گروه‌بندی داده‌های آماری کاربران',
            },
          },
        },
      },
      {
        name: 'get_signals_list',
        description:
          'دریافت لیست و فیلتر پیشرفته سیگنال‌های معاملات طلا: فیلتر بر اساس بازه تاریخ ایجاد (fromDate, toDate)، تاریخ بسته شدن (closedFromDate, closedToDate)، آرایه‌ای از وضعیت‌ها (statuses: Pending, Active, Closed, Cancelled, Deleted)، نوع معامله (types: Buy, Sell)، سورس سیگنال (sources: Telegram, Manual, Ai)، آی‌دی ثبت‌کننده (ownerId)، ریسک‌فری بودن (riskFree)، فعال بودن هوش مصنوعی (aiCopilotActive)، بازه پیپ (minPip, maxPip)، بازه نسبت ریسک به ریوارد (minRiskReward, maxRiskReward) و صفحه‌بندی (skip, take).',
        inputSchema: {
          type: 'object',
          properties: {
            fromDate: {
              type: 'string',
              description: 'تاریخ شروع ثبت سیگنال به فرمت ISO 8601',
            },
            toDate: {
              type: 'string',
              description: 'تاریخ پایان ثبت سیگنال به فرمت ISO 8601',
            },
            closedFromDate: {
              type: 'string',
              description: 'تاریخ شروع بسته شدن سیگنال به فرمت ISO 8601',
            },
            closedToDate: {
              type: 'string',
              description: 'تاریخ پایان بسته شدن سیگنال به فرمت ISO 8601',
            },
            statuses: {
              type: 'array',
              items: { type: 'string', enum: ['Pending', 'Active', 'Closed', 'Cancelled', 'Deleted'] },
              description: 'آرایه‌ای از وضعیت‌های مدنظر سیگنال (مثال: ["Pending", "Active", "Closed"])',
            },
            types: {
              type: 'array',
              items: { type: 'string', enum: ['Buy', 'Sell'] },
              description: 'آرایه‌ای از انواع سیگنال (خرید/فروش)',
            },
            sources: {
              type: 'array',
              items: { type: 'string', enum: ['Telegram', 'Manual', 'Ai'] },
              description: 'آرایه‌ای از سورس‌های ارسال سیگنال',
            },
            ownerId: {
              type: 'string',
              description: 'شناسه کاربر ثبت‌کننده سیگنال (ObjectId)',
            },
            riskFree: {
              type: 'boolean',
              description: 'فیلتر سیگنال‌های ریسک‌فری شده',
            },
            aiCopilotActive: {
              type: 'boolean',
              description: 'فیلتر سیگنال‌هایی که دستیار هوش مصنوعی Copilot روی آن‌ها فعال است',
            },
            minPip: {
              type: 'number',
              description: 'حداقل پیپ سود/زیان سیگنال‌های بسته شده',
            },
            maxPip: {
              type: 'number',
              description: 'حداکثر پیپ سود/زیان سیگنال‌های بسته شده',
            },
            minRiskReward: {
              type: 'number',
              description: 'حداقل نسبت ریسک به ریوارد (Risk/Reward)',
            },
            maxRiskReward: {
              type: 'number',
              description: 'حداکثر نسبت ریسک به ریوارد (Risk/Reward)',
            },
            sortBy: {
              type: 'string',
              enum: ['createdAt', 'closedAt', 'pip', 'score', 'entryPrice'],
              description: 'فیلد مرتب‌سازی سیگنال‌ها (پیش‌فرض createdAt)',
            },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'جهت مرتب‌سازی (پیش‌فرض desc)',
            },
            skip: {
              type: 'number',
              description: 'تعداد رکوردهایی که برای صفحه‌بندی باید صرف‌نظر شوند (پیش‌فرض ۰)',
            },
            take: {
              type: 'number',
              description: 'تعداد رکوردهای خروجی در هر صفحه (پیش‌فرض ۵۰، حداکثر ۲۰۰)',
            },
          },
        },
      },
      {
        name: 'get_signals_overview',
        description:
          'تحلیل جامع و خلاصه آماری سیگنال‌های طلا در بازه تاریخ مشخص (fromDate تا toDate): وین‌ریت کل، مجموع پیپ (Pip) سود/زیان، میانگین پیپ هر سیگنال، تفکیک بر اساس وضعیت‌ها، انواع (خرید/فروش) و سورس‌ها.',
        inputSchema: {
          type: 'object',
          properties: {
            fromDate: {
              type: 'string',
              description: 'تاریخ شروع تحلیل ISO',
            },
            toDate: {
              type: 'string',
              description: 'تاریخ پایان تحلیل ISO',
            },
            groupBy: {
              type: 'string',
              enum: ['status', 'type', 'source', 'date', 'none'],
              description: 'نحوه گروه‌بندی داده‌های سیگنال',
            },
          },
        },
      },
      {
        name: 'get_leaderboard',
        description:
          'دریافت لیدربورد و رتبه‌بندی برترین کاربران Ounce24 بر اساس فیلدهای مختلف: امتیاز کل (totalScore)، امتیاز هفتگی (weekScore)، امتیاز ماهانه (monthScore)، وین‌ریت (winRate)، تعداد کل سیگنال‌ها (totalSignals) یا موجودی جم (gem) با امکان فیلتر بازه تاریخ ثبت‌نام (fromDate, toDate) و صفحه‌بندی (skip, take).',
        inputSchema: {
          type: 'object',
          properties: {
            metric: {
              type: 'string',
              enum: ['totalScore', 'weekScore', 'monthScore', 'winRate', 'totalSignals', 'gem'],
              description: 'معیار رتبه‌بندی لیدربورد (پیش‌فرض totalScore)',
            },
            fromDate: {
              type: 'string',
              description: 'تاریخ شروع ثبت‌نام کاربران برای لیدربورد ISO',
            },
            toDate: {
              type: 'string',
              description: 'تاریخ پایان ثبت‌نام کاربران برای لیدربورد ISO',
            },
            minSignals: {
              type: 'number',
              description: 'حداقل تعداد سیگنال لازم برای حضور در لیدربورد',
            },
            skip: {
              type: 'number',
              description: 'تعداد رکوردهای صرف‌نظر شده (صفحه‌بندی)',
            },
            take: {
              type: 'number',
              description: 'تعداد رکوردهای بازگشتی لیدربورد (پیش‌فرض ۵۰)',
            },
          },
        },
      },
      {
        name: 'get_ai_usage_stats',
        description:
          'تحلیل کامل میزان استفاده از هوش مصنوعی (AI): آمار مصرف توکن‌ها (PromptTokens, CompletionTokens, TotalTokens)، محاسبه هزینه تخمینی به تومان (به تومان)، مدل‌های استفاده شده (gpt-4o و ...)، میانگین تاخیر (Latency) و کالیبراسیون دقت پیش‌بینی هوش مصنوعی نسبت به نتایج واقعی سیگنال‌ها در بازه تاریخ (fromDate, toDate).',
        inputSchema: {
          type: 'object',
          properties: {
            fromDate: {
              type: 'string',
              description: 'تاریخ شروع تحلیل هوش مصنوعی ISO',
            },
            toDate: {
              type: 'string',
              description: 'تاریخ پایان تحلیل هوش مصنوعی ISO',
            },
            models: {
              type: 'array',
              items: { type: 'string' },
              description: 'آرایه‌ای از مدل‌های مدنظر هوش مصنوعی (مثال: ["gpt-4o", "gpt-4o-mini"])',
            },
            types: {
              type: 'array',
              items: { type: 'string' },
              description: 'آرایه‌ای از انواع ارزیابی هوش مصنوعی (AiEvaluationType)',
            },
            groupBy: {
              type: 'string',
              enum: ['model', 'type', 'date', 'none'],
              description: 'نحوه گروه‌بندی داده‌های استفاده از هوش مصنوعی',
            },
          },
        },
      },
      {
        name: 'get_gem_analytics',
        description:
          'تحلیل کامل اقتصاد جم (Gem Economy) و پاداش‌ها: مجموع جم‌های موجود در سیستم، لیست ریز تراکنش‌های جم در بازه تاریخ (fromDate, toDate)، فیلتر بر اساس آرایه اکشن‌ها (actions: GemLogAction) به همراه صفحه‌بندی (skip, take).',
        inputSchema: {
          type: 'object',
          properties: {
            fromDate: {
              type: 'string',
              description: 'تاریخ شروع تراکنش‌های جم ISO',
            },
            toDate: {
              type: 'string',
              description: 'تاریخ پایان تراکنش‌های جم ISO',
            },
            actions: {
              type: 'array',
              items: { type: 'string' },
              description: 'آرایه‌ای از اکشن‌های تراکنش جم (GemLogAction)',
            },
            userId: {
              type: 'string',
              description: 'شناسه کاربر خاص (ObjectId)',
            },
            skip: {
              type: 'number',
              description: 'تعداد رکوردهای صرف‌نظر شده (صفحه‌بندی)',
            },
            take: {
              type: 'number',
              description: 'تعداد رکوردهای بازگشتی (پیش‌فرض ۵۰)',
            },
          },
        },
      },
      {
        name: 'get_octopus_analytics',
        description:
          'تحلیل پیش‌بینی‌های جمعی اختاپوس (Octopus Predictions): جهت‌های صعودی/نزولی ثبت شده توسط کاربران در بازه تاریخ (fromDate, toDate) به همراه قیمت‌های ثبت شده و دقت پیش‌بینی‌ها.',
        inputSchema: {
          type: 'object',
          properties: {
            fromDate: {
              type: 'string',
              description: 'تاریخ شروع پیش‌بینی‌های اختاپوس ISO',
            },
            toDate: {
              type: 'string',
              description: 'تاریخ پایان پیش‌بینی‌های اختاپوس ISO',
            },
            direction: {
              type: 'string',
              enum: ['up', 'down'],
              description: 'جهت پیش‌بینی (صعودی یا نزولی)',
            },
            skip: {
              type: 'number',
              description: 'تعداد رکوردهای صرف‌نظر شده',
            },
            take: {
              type: 'number',
              description: 'تعداد رکوردهای خروجی',
            },
          },
        },
      },
      {
        name: 'query_collection_raw',
        description:
          'اجرای کوئری خواندنی (Read-Only) روی هر یک از کالکشن‌های دیتابیس MongoDB: امکان استفاده از find، countDocuments، یا aggregate pipeline به صورت مستقیم با امکان فیلتر، پروژکشن، سورت و صفحه‌بندی (skip, take).',
        inputSchema: {
          type: 'object',
          required: ['collectionName'],
          properties: {
            collectionName: {
              type: 'string',
              description:
                'نام کالکشن دیتابیس (مثال: users, signals, aievaluations, signalanalyzes, gemlogs, octopuspredictions, pushsubscriptions, podcasts, ouncepricecandles, achievements, follows, signalsubscriptions)',
            },
            filter: {
              type: 'object',
              description: 'فیلتر خواندن Mongoose/MongoDB به صورت JSON',
            },
            projection: {
              type: 'object',
              description: 'فیلدهای خروجی (Projection)',
            },
            sort: {
              type: 'object',
              description: 'مرتب‌سازی (مثال: { "createdAt": -1 })',
            },
            skip: {
              type: 'number',
              description: 'تعداد سندهایی که باید برای صفحه‌بندی صرف‌نظر شوند (Offset)',
            },
            take: {
              type: 'number',
              description: 'تعداد سندهای خروجی (Limit، حداکثر ۲۰۰، پیش‌فرض ۲۰)',
            },
            aggregatePipeline: {
              type: 'array',
              description: 'مراحل Aggregation Pipeline به صورت آرایه از استیج‌ها',
            },
          },
        },
      },
    ];
  }

  async executeTool(name: string, args: Record<string, any> = {}) {
    switch (name) {
      case 'get_database_summary':
        return this.getDatabaseSummary();
      case 'get_users_list':
        return this.getUsersList(args);
      case 'get_user_analytics':
        return this.getUserAnalytics(args);
      case 'get_signals_list':
        return this.getSignalsList(args);
      case 'get_signals_overview':
        return this.getSignalsOverview(args);
      case 'get_leaderboard':
        return this.getLeaderboard(args);
      case 'get_ai_usage_stats':
        return this.getAiUsageStats(args);
      case 'get_gem_analytics':
        return this.getGemAnalytics(args);
      case 'get_octopus_analytics':
        return this.getOctopusAnalytics(args);
      case 'query_collection_raw':
        return this.queryCollectionRaw(args);
      default:
        throw new Error(`Tool '${name}' not found.`);
    }
  }

  // 1. Database Summary
  private async getDatabaseSummary() {
    const collections = [
      { name: 'users', model: this.userModel },
      { name: 'signals', model: this.signalModel },
      { name: 'aievaluations', model: this.aiEvaluationModel },
      { name: 'signalanalyzes', model: this.signalAnalyzeModel },
      { name: 'gemlogs', model: this.gemLogModel },
      { name: 'octopuspredictions', model: this.octopusPredictionModel },
      { name: 'pushsubscriptions', model: this.pushSubscriptionModel },
      { name: 'podcasts', model: this.podcastModel },
      { name: 'achievements', model: this.achievementModel },
      { name: 'ouncepricecandles', model: this.ouncePriceCandleModel },
      { name: 'signalsubscriptions', model: this.signalSubscriptionModel },
      { name: 'follows', model: this.followModel },
    ];

    const collectionStats = await Promise.all(
      collections.map(async (item) => {
        try {
          const count = await item.model.countDocuments();
          return {
            collection: item.name,
            documentCount: count,
            status: 'active',
          };
        } catch (error) {
          return {
            collection: item.name,
            documentCount: 0,
            error: error.message,
          };
        }
      }),
    );

    let dbStats: any = {};
    try {
      if (this.connection.db) {
        const stats = await this.connection.db.stats();
        dbStats = {
          dbName: this.connection.name,
          collectionsCount: stats.collections,
          documentsCount: stats.objects,
          dataSizeMB: Number((stats.dataSize / (1024 * 1024)).toFixed(2)),
          storageSizeMB: Number((stats.storageSize / (1024 * 1024)).toFixed(2)),
          indexesCount: stats.indexes,
          indexSizeMB: Number((stats.indexSize / (1024 * 1024)).toFixed(2)),
        };
      }
    } catch (err) {
      dbStats = { error: err.message };
    }

    return {
      timestamp: new Date().toISOString(),
      database: dbStats,
      collections: collectionStats,
    };
  }

  // 2. Comprehensive Users List & Multi-Filter Query
  private async getUsersList(args: Record<string, any>) {
    const {
      fromDate,
      toDate,
      signalFromDate,
      signalToDate,
      minSignals,
      maxSignals,
      minScore,
      maxScore,
      minWinRate,
      maxWinRate,
      sources,
      hasPushSubscribed,
      language,
      sortBy = 'totalScore',
      sortOrder = 'desc',
      skip = 0,
      take = 50,
    } = args;

    const query: any = {};

    // Date range filter for user registration
    const dateFilter: any = {};
    if (fromDate) dateFilter.$gte = new Date(fromDate);
    if (toDate) dateFilter.$lte = new Date(toDate);
    if (Object.keys(dateFilter).length > 0) {
      query.createdAt = dateFilter;
    }

    // Number filters
    if (minSignals !== undefined || maxSignals !== undefined) {
      query.totalSignals = {};
      if (minSignals !== undefined) query.totalSignals.$gte = Number(minSignals);
      if (maxSignals !== undefined) query.totalSignals.$lte = Number(maxSignals);
    }

    if (minScore !== undefined || maxScore !== undefined) {
      query.totalScore = {};
      if (minScore !== undefined) query.totalScore.$gte = Number(minScore);
      if (maxScore !== undefined) query.totalScore.$lte = Number(maxScore);
    }

    if (minWinRate !== undefined || maxWinRate !== undefined) {
      query.winRate = {};
      if (minWinRate !== undefined) query.winRate.$gte = Number(minWinRate);
      if (maxWinRate !== undefined) query.winRate.$lte = Number(maxWinRate);
    }

    if (language) {
      query.language = language;
    }

    // Sources filter
    if (sources && Array.isArray(sources) && sources.length > 0) {
      const sourceConditions: any[] = [];
      if (sources.includes('telegram')) {
        sourceConditions.push(
          { telegramId: { $exists: true, $ne: null } },
          { avatarSource: 'telegram' },
          { telegramUsername: { $exists: true, $ne: null } },
        );
      }
      if (sources.includes('google')) {
        sourceConditions.push(
          { googleId: { $exists: true, $ne: null } },
          { avatarSource: 'google' },
          { email: { $exists: true, $ne: null } },
        );
      }
      if (sources.includes('phone')) {
        sourceConditions.push({ phone: { $exists: true, $ne: null } });
      }
      if (sources.includes('bitbots')) {
        sourceConditions.push({ avatarSource: 'bitbots' });
      }

      if (sourceConditions.length > 0) {
        query.$or = sourceConditions;
      }
    }

    // Cross-query: Filter users who created signals within a specific date range
    if (signalFromDate || signalToDate) {
      const signalDateQuery: any = {};
      if (signalFromDate) signalDateQuery.$gte = new Date(signalFromDate);
      if (signalToDate) signalDateQuery.$lte = new Date(signalToDate);

      const activeOwners = await this.signalModel
        .distinct('owner', { createdAt: signalDateQuery });

      query._id = { $in: activeOwners };
    }

    // Push subscription filter
    if (hasPushSubscribed === true) {
      const subscribedUserIds = await this.pushSubscriptionModel
        .distinct('userId', { userId: { $ne: null } });
      query._id = query._id
        ? { $in: activeOwnerMatch(query._id.$in, subscribedUserIds) }
        : { $in: subscribedUserIds };
    }

    const effectiveTake = Math.min(Math.max(1, take), 200);
    const effectiveSkip = Math.max(0, skip);

    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [totalMatching, users] = await Promise.all([
      this.userModel.countDocuments(query),
      this.userModel
        .find(query)
        .sort(sortOptions)
        .skip(effectiveSkip)
        .limit(effectiveTake)
        .lean(),
    ]);

    return {
      pagination: {
        totalMatchingUsers: totalMatching,
        skip: effectiveSkip,
        take: effectiveTake,
        hasMore: effectiveSkip + users.length < totalMatching,
      },
      users: users.map((u: any) => ({
        id: u._id,
        name: u.name || u.title || 'کاربر بدون نام',
        title: u.title || null,
        phone: u.phone || null,
        email: u.email || null,
        telegramUsername: u.telegramUsername || null,
        telegramId: u.telegramId || null,
        googleId: u.googleId || null,
        avatarSource: u.avatarSource || null,
        totalScore: u.totalScore || 0,
        weekScore: u.weekScore || 0,
        monthScore: u.monthScore || 0,
        score: u.score || 0,
        winRate: u.winRate || 0,
        totalSignals: u.totalSignals || 0,
        weekSignals: u.weekSignals || 0,
        monthSignals: u.monthSignals || 0,
        gemBalance: u.gem || 0,
        language: u.language || 'en',
        registeredAt: u.createdAt,
      })),
    };
  }

  // 3. User Analytics Overview
  private async getUserAnalytics(args: Record<string, any>) {
    const { fromDate, toDate, groupBy = 'none' } = args;

    const dateFilter: any = {};
    if (fromDate) dateFilter.$gte = new Date(fromDate);
    if (toDate) dateFilter.$lte = new Date(toDate);

    const query: any = {};
    if (Object.keys(dateFilter).length > 0) {
      query.createdAt = dateFilter;
    }

    const totalUsers = await this.userModel.countDocuments();
    const filteredUsersCount = await this.userModel.countDocuments(query);

    const [telegramUsers, googleUsers, phoneUsers, bitbotsUsers] = await Promise.all([
      this.userModel.countDocuments({
        ...query,
        $or: [
          { telegramId: { $exists: true, $ne: null } },
          { avatarSource: 'telegram' },
          { telegramUsername: { $exists: true, $ne: null } },
        ],
      }),
      this.userModel.countDocuments({
        ...query,
        $or: [
          { googleId: { $exists: true, $ne: null } },
          { avatarSource: 'google' },
          { email: { $exists: true, $ne: null } },
        ],
      }),
      this.userModel.countDocuments({ ...query, phone: { $exists: true, $ne: null } }),
      this.userModel.countDocuments({ ...query, avatarSource: 'bitbots' }),
    ]);

    const pushSubscribersCount = await this.pushSubscriptionModel.countDocuments();
    const notifPriceEnabled = await this.userModel.countDocuments({ ...query, notifPrice: true });
    const notifSignalFollowEnabled = await this.userModel.countDocuments({ ...query, notifSignalFollow: true });
    const notifAiShieldEnabled = await this.userModel.countDocuments({ ...query, notifAiShield: true });

    let groupedResults: any[] = [];
    if (groupBy === 'source') {
      groupedResults = [
        { source: 'Telegram', count: telegramUsers },
        { source: 'Google OAuth', count: googleUsers },
        { source: 'Phone OTP', count: phoneUsers },
        { source: 'Bitbots', count: bitbotsUsers },
      ];
    } else if (groupBy === 'language') {
      groupedResults = await this.userModel.aggregate([
        { $match: query },
        { $group: { _id: '$language', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
    } else if (groupBy === 'date') {
      groupedResults = await this.userModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    }

    return {
      timeframe: { fromDate, toDate },
      userCounts: {
        totalDatabaseUsers: totalUsers,
        matchingFilterUsers: filteredUsersCount,
      },
      trafficSources: {
        telegram: telegramUsers,
        google: googleUsers,
        phoneOTP: phoneUsers,
        bitbots: bitbotsUsers,
      },
      pushNotifications: {
        pushWebSubscribers: pushSubscribersCount,
        notifPriceActive: notifPriceEnabled,
        notifSignalFollowActive: notifSignalFollowEnabled,
        notifAiShieldActive: notifAiShieldEnabled,
      },
      groupedData: groupedResults,
    };
  }

  // 4. Signals List & Advanced Filtering
  private async getSignalsList(args: Record<string, any>) {
    const {
      fromDate,
      toDate,
      closedFromDate,
      closedToDate,
      statuses,
      types,
      sources,
      ownerId,
      riskFree,
      aiCopilotActive,
      minPip,
      maxPip,
      minRiskReward,
      maxRiskReward,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      skip = 0,
      take = 50,
    } = args;

    const query: any = {};

    // Created date filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    // Closed date filter
    if (closedFromDate || closedToDate) {
      query.closedAt = {};
      if (closedFromDate) query.closedAt.$gte = new Date(closedFromDate);
      if (closedToDate) query.closedAt.$lte = new Date(closedToDate);
    }

    // Multi-status filter
    if (statuses && Array.isArray(statuses) && statuses.length > 0) {
      query.status = { $in: statuses };
    }

    // Multi-type filter (Buy / Sell)
    if (types && Array.isArray(types) && types.length > 0) {
      query.type = { $in: types };
    }

    // Multi-source filter (Telegram / Manual / Ai)
    if (sources && Array.isArray(sources) && sources.length > 0) {
      query.source = { $in: sources };
    }

    if (ownerId) query.owner = ownerId;
    if (riskFree !== undefined) query.riskFree = riskFree;
    if (aiCopilotActive !== undefined) query.aiCopilotActive = aiCopilotActive;

    const effectiveTake = Math.min(Math.max(1, take), 200);
    const effectiveSkip = Math.max(0, skip);

    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [totalMatching, signals] = await Promise.all([
      this.signalModel.countDocuments(query),
      this.signalModel
        .find(query)
        .populate('owner', 'name title score winRate')
        .sort(sortOptions)
        .skip(effectiveSkip)
        .limit(effectiveTake)
        .lean(),
    ]);

    // Compute stats for closed signals matching query
    const closedSignals = signals.filter((s: any) => s.status === 'Closed');
    let winCount = 0;
    let lossCount = 0;
    let totalPips = 0;

    closedSignals.forEach((s: any) => {
      if (s.closedOuncePrice && s.entryPrice) {
        const isSell = s.type === 'Sell';
        const diff = isSell
          ? s.entryPrice - s.closedOuncePrice
          : s.closedOuncePrice - s.entryPrice;
        let pip = Number((diff * 10).toFixed(3));
        if (s.riskFree && pip < 0) pip = 0;

        totalPips += pip;
        if (pip >= 0) winCount++;
        else lossCount++;
      }
    });

    const totalClosedInPage = closedSignals.length;
    const winRateInPage =
      totalClosedInPage > 0
        ? Number(((winCount / totalClosedInPage) * 100).toFixed(2))
        : 0;

    return {
      pagination: {
        totalMatchingSignals: totalMatching,
        skip: effectiveSkip,
        take: effectiveTake,
        hasMore: effectiveSkip + signals.length < totalMatching,
      },
      pagePerformance: {
        closedSignalsInPageCount: totalClosedInPage,
        winCount,
        lossCount,
        winRatePercent: winRateInPage,
        totalPipsGainedOrLost: totalPips,
      },
      signals: signals.map((s: any) => ({
        id: s._id,
        type: s.type,
        status: s.status,
        source: s.source,
        entryPrice: s.entryPrice,
        maxPrice: s.maxPrice,
        minPrice: s.minPrice,
        closedOuncePrice: s.closedOuncePrice || null,
        createdOuncePrice: s.createdOuncePrice,
        owner: s.owner ? { id: s.owner._id, name: s.owner.name || s.owner.title } : null,
        riskFree: s.riskFree || false,
        aiCopilotActive: s.aiCopilotActive || false,
        gemReward: s.gem || 0,
        createdAt: s.createdAt,
        closedAt: s.closedAt || null,
      })),
    };
  }

  // 5. Signals Overview
  private async getSignalsOverview(args: Record<string, any>) {
    const { fromDate, toDate, groupBy = 'none' } = args;

    const query: any = {};
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const totalSignals = await this.signalModel.countDocuments();
    const matchingSignalsCount = await this.signalModel.countDocuments(query);

    const [statusCounts, typeCounts, sourceCounts] = await Promise.all([
      this.signalModel.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.signalModel.aggregate([
        { $match: query },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      this.signalModel.aggregate([
        { $match: query },
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
    ]);

    const closedSignals = await this.signalModel
      .find({ ...query, status: 'Closed' })
      .lean();

    let winCount = 0;
    let lossCount = 0;
    let totalPips = 0;

    closedSignals.forEach((s: any) => {
      if (s.closedOuncePrice && s.entryPrice) {
        const isSell = s.type === 'Sell';
        const diff = isSell
          ? s.entryPrice - s.closedOuncePrice
          : s.closedOuncePrice - s.entryPrice;
        let pip = Number((diff * 10).toFixed(3));
        if (s.riskFree && pip < 0) pip = 0;

        totalPips += pip;
        if (pip >= 0) winCount++;
        else lossCount++;
      }
    });

    const totalClosed = closedSignals.length;
    const winRate = totalClosed > 0 ? Number(((winCount / totalClosed) * 100).toFixed(2)) : 0;

    let groupedResults: any[] = [];
    if (groupBy === 'status') groupedResults = statusCounts;
    else if (groupBy === 'type') groupedResults = typeCounts;
    else if (groupBy === 'source') groupedResults = sourceCounts;
    else if (groupBy === 'date') {
      groupedResults = await this.signalModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    }

    return {
      timeframe: { fromDate, toDate },
      counts: {
        totalDatabaseSignals: totalSignals,
        matchingFilterSignals: matchingSignalsCount,
      },
      breakdown: {
        byStatus: Object.fromEntries(statusCounts.map((s) => [s._id || 'Unknown', s.count])),
        byType: Object.fromEntries(typeCounts.map((t) => [t._id || 'Unknown', t.count])),
        bySource: Object.fromEntries(sourceCounts.map((sc) => [sc._id || 'Unknown', sc.count])),
      },
      performance: {
        closedSignalsCount: totalClosed,
        winCount,
        lossCount,
        winRatePercent: winRate,
        totalPipsGainedOrLost: totalPips,
      },
      groupedData: groupedResults,
    };
  }

  // 6. Dedicated Leaderboard Tool
  private async getLeaderboard(args: Record<string, any>) {
    const {
      metric = 'totalScore',
      fromDate,
      toDate,
      minSignals,
      skip = 0,
      take = 50,
    } = args;

    const query: any = {};
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }
    if (minSignals !== undefined) {
      query.totalSignals = { $gte: Number(minSignals) };
    }

    const sortOptions: any = {};
    sortOptions[metric] = -1;

    const effectiveTake = Math.min(Math.max(1, take), 200);
    const effectiveSkip = Math.max(0, skip);

    const [totalRanked, topUsers] = await Promise.all([
      this.userModel.countDocuments(query),
      this.userModel
        .find(query)
        .select('name title score totalScore weekScore monthScore winRate totalSignals gem telegramUsername createdAt')
        .sort(sortOptions)
        .skip(effectiveSkip)
        .limit(effectiveTake)
        .lean(),
    ]);

    return {
      metric,
      pagination: {
        totalRankedUsers: totalRanked,
        skip: effectiveSkip,
        take: effectiveTake,
      },
      leaderboard: topUsers.map((u: any, index: number) => ({
        rank: effectiveSkip + index + 1,
        id: u._id,
        name: u.name || u.title || 'کاربر بدون نام',
        metricValue: u[metric] || 0,
        totalScore: u.totalScore || 0,
        weekScore: u.weekScore || 0,
        monthScore: u.monthScore || 0,
        winRate: u.winRate || 0,
        totalSignals: u.totalSignals || 0,
        gemBalance: u.gem || 0,
        registeredAt: u.createdAt,
      })),
    };
  }

  // 7. AI Usage & Accuracy Stats
  private async getAiUsageStats(args: Record<string, any>) {
    const { fromDate, toDate, models, types, groupBy = 'none' } = args;

    const query: any = {};
    if (models && Array.isArray(models) && models.length > 0) {
      query.model = { $in: models };
    }
    if (types && Array.isArray(types) && types.length > 0) {
      query.type = { $in: types };
    }

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const evaluations = await this.aiEvaluationModel.find(query).lean();
    const totalEvaluationsCount = evaluations.length;
    const signalAnalyzeCount = await this.signalAnalyzeModel.countDocuments(query);

    let promptTokensTotal = 0;
    let completionTokensTotal = 0;
    let totalTokensTotal = 0;
    let totalLatencyMs = 0;

    const modelBreakdown: Record<string, number> = {};
    const typeBreakdown: Record<string, number> = {};

    evaluations.forEach((evalItem: any) => {
      promptTokensTotal += evalItem.promptTokens || 0;
      completionTokensTotal += evalItem.completionTokens || 0;
      totalTokensTotal += evalItem.totalTokens || 0;
      totalLatencyMs += evalItem.latencyMs || 0;

      const m = evalItem.model || 'unknown';
      modelBreakdown[m] = (modelBreakdown[m] || 0) + 1;

      const t = evalItem.type || 'unknown';
      typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
    });

    const avgLatencyMs =
      totalEvaluationsCount > 0
        ? Number((totalLatencyMs / totalEvaluationsCount).toFixed(2))
        : 0;

    const promptCostUSD = (promptTokensTotal / 1_000_000) * 2.5;
    const completionCostUSD = (completionTokensTotal / 1_000_000) * 10;
    const totalCostUSD = promptCostUSD + completionCostUSD;
    const estimatedCostToman = Math.round(totalCostUSD * 60_000);

    const actualOutcomes = await this.aiEvaluationModel.aggregate([
      { $match: query },
      { $group: { _id: '$actualOutcome', count: { $sum: 1 } } },
    ]);

    let groupedResults: any[] = [];
    if (groupBy === 'model') {
      groupedResults = Object.entries(modelBreakdown).map(([k, v]) => ({
        model: k,
        evaluationsCount: v,
      }));
    } else if (groupBy === 'type') {
      groupedResults = Object.entries(typeBreakdown).map(([k, v]) => ({
        type: k,
        evaluationsCount: v,
      }));
    } else if (groupBy === 'date') {
      groupedResults = await this.aiEvaluationModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            totalTokens: { $sum: '$totalTokens' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    }

    return {
      timeframe: { fromDate, toDate },
      counts: {
        aiEvaluationsCount: totalEvaluationsCount,
        signalAnalysesCount: signalAnalyzeCount,
        totalAiInvocations: totalEvaluationsCount + signalAnalyzeCount,
      },
      tokenConsumption: {
        promptTokensTotal,
        completionTokensTotal,
        totalTokensTotal,
        estimatedCostUSD: Number(totalCostUSD.toFixed(4)),
        estimatedCostToman: estimatedCostToman,
        currencyNote: 'هزینه‌ها بر اساس نرخ تقریبی دلار و به تومان محاسبه شده است.',
      },
      performance: {
        avgLatencyMs,
        modelsUsed: modelBreakdown,
        evalTypes: typeBreakdown,
        actualOutcomeCalibration: Object.fromEntries(
          actualOutcomes.map((o) => [o._id || 'None', o.count]),
        ),
      },
      groupedData: groupedResults,
    };
  }

  // 8. Gem Economy Analytics & Logs
  private async getGemAnalytics(args: Record<string, any>) {
    const {
      fromDate,
      toDate,
      actions,
      userId,
      skip = 0,
      take = 50,
    } = args;

    const query: any = {};
    if (actions && Array.isArray(actions) && actions.length > 0) {
      query.action = { $in: actions };
    }
    if (userId) query.user = userId;

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const effectiveTake = Math.min(Math.max(1, take), 200);
    const effectiveSkip = Math.max(0, skip);

    const [totalGemLogs, totalGemsResult, actionBreakdown, gemLogs] = await Promise.all([
      this.gemLogModel.countDocuments(query),
      this.userModel.aggregate([{ $group: { _id: null, totalGems: { $sum: '$gem' } } }]),
      this.gemLogModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            totalGemsChange: { $sum: '$gemsChange' },
          },
        },
        { $sort: { count: -1 } },
      ]),
      this.gemLogModel
        .find(query)
        .populate('user', 'name title phone')
        .sort({ createdAt: -1 })
        .skip(effectiveSkip)
        .limit(effectiveTake)
        .lean(),
    ]);

    const totalGemsInCirculation =
      totalGemsResult.length > 0 ? totalGemsResult[0].totalGems : 0;

    return {
      timeframe: { fromDate, toDate },
      overview: {
        totalGemsInCirculation,
        totalGemLogsMatchingFilter: totalGemLogs,
      },
      pagination: {
        skip: effectiveSkip,
        take: effectiveTake,
        hasMore: effectiveSkip + gemLogs.length < totalGemLogs,
      },
      actionBreakdown: actionBreakdown.map((a) => ({
        action: a._id,
        count: a.count,
        totalGemsChange: a.totalGemsChange,
      })),
      recentLogs: gemLogs.map((g: any) => ({
        id: g._id,
        user: g.user ? { id: g.user._id, name: g.user.name || g.user.title } : null,
        gemsChange: g.gemsChange,
        gemsBefore: g.gemsBefore,
        gemsAfter: g.gemsAfter,
        action: g.action,
        createdAt: g.createdAt,
      })),
    };
  }

  // 9. Octopus Predictions Analytics
  private async getOctopusAnalytics(args: Record<string, any>) {
    const { fromDate, toDate, direction, skip = 0, take = 50 } = args;

    const query: any = {};
    if (direction) query.direction = direction;

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const effectiveTake = Math.min(Math.max(1, take), 200);
    const effectiveSkip = Math.max(0, skip);

    const [totalPredictions, directionBreakdown, predictions] = await Promise.all([
      this.octopusPredictionModel.countDocuments(query),
      this.octopusPredictionModel.aggregate([
        { $match: query },
        { $group: { _id: '$direction', count: { $sum: 1 } } },
      ]),
      this.octopusPredictionModel
        .find(query)
        .populate('user', 'name title score')
        .sort({ createdAt: -1 })
        .skip(effectiveSkip)
        .limit(effectiveTake)
        .lean(),
    ]);

    return {
      timeframe: { fromDate, toDate },
      pagination: {
        totalPredictions,
        skip: effectiveSkip,
        take: effectiveTake,
      },
      directionBreakdown: Object.fromEntries(
        directionBreakdown.map((d) => [d._id || 'unknown', d.count]),
      ),
      predictions: predictions.map((p: any) => ({
        id: p._id,
        user: p.user ? { id: p.user._id, name: p.user.name || p.user.title } : null,
        direction: p.direction,
        votePrice: p.votePrice,
        voteDate: p.voteDate,
        closePrice: p.closePrice || null,
        points: p.points || null,
        createdAt: p.createdAt,
      })),
    };
  }

  // 10. Generic Raw Mongoose/MongoDB Read-Only Query Tool
  private async queryCollectionRaw(args: Record<string, any>) {
    const {
      collectionName,
      filter = {},
      projection = null,
      sort = { createdAt: -1 },
      skip = 0,
      take = 20,
      aggregatePipeline,
    } = args;

    if (!collectionName) {
      throw new Error("Field 'collectionName' is required.");
    }

    const effectiveTake = Math.min(Math.max(1, take), 200);
    const effectiveSkip = Math.max(0, skip);
    const targetModel = this.getModelByCollectionName(collectionName);

    if (aggregatePipeline && Array.isArray(aggregatePipeline)) {
      const forbiddenStages = ['$out', '$merge'];
      for (const stage of aggregatePipeline) {
        const keys = Object.keys(stage);
        if (keys.some((k) => forbiddenStages.includes(k))) {
          throw new Error(`Aggregation stage '${keys.join(', ')}' is not allowed in read-only mode.`);
        }
      }

      const aggregateResults = await targetModel.aggregate(aggregatePipeline);
      return {
        collection: collectionName,
        mode: 'aggregate',
        pipeline: aggregatePipeline,
        resultCount: aggregateResults.length,
        data: aggregateResults,
      };
    }

    const [totalCount, documents] = await Promise.all([
      targetModel.countDocuments(filter),
      targetModel
        .find(filter, projection)
        .sort(sort)
        .skip(effectiveSkip)
        .limit(effectiveTake)
        .lean(),
    ]);

    return {
      collection: collectionName,
      mode: 'find',
      filter,
      totalCount,
      returnedCount: documents.length,
      skip: effectiveSkip,
      take: effectiveTake,
      data: documents,
    };
  }

  private getModelByCollectionName(name: string): Model<any> {
    const cleanName = name.toLowerCase().trim();
    switch (cleanName) {
      case 'users':
      case 'user':
        return this.userModel;
      case 'signals':
      case 'signal':
        return this.signalModel;
      case 'aievaluations':
      case 'aievaluation':
        return this.aiEvaluationModel;
      case 'signalanalyzes':
      case 'signalanalyze':
        return this.signalAnalyzeModel;
      case 'gemlogs':
      case 'gemlog':
        return this.gemLogModel;
      case 'octopuspredictions':
      case 'octopusprediction':
        return this.octopusPredictionModel;
      case 'pushsubscriptions':
      case 'pushsubscription':
        return this.pushSubscriptionModel;
      case 'podcasts':
      case 'podcast':
        return this.podcastModel;
      case 'achievements':
      case 'achievement':
        return this.achievementModel;
      case 'ouncepricecandles':
      case 'ouncepricecandle':
        return this.ouncePriceCandleModel;
      case 'signalsubscriptions':
      case 'signalsubscription':
        return this.signalSubscriptionModel;
      case 'follows':
      case 'follow':
        return this.followModel;
      default:
        throw new Error(
          `Unknown collection name '${name}'. Supported: users, signals, aievaluations, signalanalyzes, gemlogs, octopuspredictions, pushsubscriptions, podcasts, achievements, ouncepricecandles, signalsubscriptions, follows.`,
        );
    }
  }
}

function activeOwnerMatch(arr1?: any[], arr2?: any[]) {
  if (!arr1) return arr2 || [];
  if (!arr2) return arr1 || [];
  const set2 = new Set(arr2.map((x) => String(x)));
  return arr1.filter((x) => set2.has(String(x)));
}
