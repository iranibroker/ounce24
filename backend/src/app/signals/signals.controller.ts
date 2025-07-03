import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  NotAcceptableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  GemLog,
  GemLogAction,
  Signal,
  SignalSource,
  SignalStatus,
  User,
} from '@ounce24/types';
import { Model } from 'mongoose';
import { Public } from '../auth/public.decorator';
import { LoginUser } from '../auth/user.decorator';
import { SignalsService } from './signals.service';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { CoreMessage, generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

@Controller('signals')
export class SignalsController {
  constructor(
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(GemLog.name) private gemLogModel: Model<GemLog>,
    private readonly signalService: SignalsService,
    private readonly ouncePriceService: OuncePriceService,
  ) {}

  @Public()
  @Get(':id')
  getSignal(@Param('id') id: string) {
    return this.signalModel.findById(id).populate(['owner']).exec();
  }

  @Public()
  @Get('active')
  activeSignals() {
    return this.signalModel
      .find({
        status: { $in: [SignalStatus.Active, SignalStatus.Pending] },
        deletedAt: null,
      })
      .select(['-messageId', '-_id', '-owner']);
  }

  @Public()
  @Get('tempList')
  tempListSignals() {
    return this.signalModel
      .find({
        deletedAt: null,
      })
      .populate(['owner'])
      .sort({
        createdAt: -1,
      })
      .limit(20);
  }

  @Public()
  @Get('status/:status')
  filterStatus(
    @Param('status') status: SignalStatus,
    @Query('page') page?: string,
  ) {
    const PAGE_SIZE = 20;
    return this.signalModel
      .find({
        deletedAt: null,
        status,
        publishable: true,
      })
      .populate(['owner'])
      .sort({
        updatedAt: -1,
      })
      .limit(PAGE_SIZE)
      .skip(page ? Number(page) * PAGE_SIZE : 0);
  }

  @Post()
  createSignal(@Body() signal: Signal, @LoginUser() user: User) {
    return this.signalService.addSignal({
      ...signal,
      owner: user,
      createdOuncePrice: this.ouncePriceService.current,
      source: SignalSource.Web,
    });
  }

  @Post('analyze')
  async analyzeSignal(@Body() signal: Signal, @LoginUser() user: User) {
    // Check if user has gems
    const currentUser = await this.userModel.findById(user.id).exec();
    if (!currentUser) {
      throw new NotAcceptableException('User not found');
    }

    if (!currentUser.gem || currentUser.gem <= 0) {
      throw new NotAcceptableException('Insufficient gems to analyze signal');
    }

    delete signal.owner;
    signal.createdOuncePrice = this.ouncePriceService.current;
    const messages: CoreMessage[] = [
      {
        role: 'system',
        content: `
          دریافت کنید و تحلیل کوتاه و محاوره‌ای برای خرید و فروش انس طلا براساس اطلاعات کاربر و تکمیلی از TradingView آماده کنید.

# مراحل

1. **دریافت قیمت لحظه‌ای از کاربر**: قیمتی که کاربر می‌دهد را دریافت کنید.
2. **جمع‌آوری اطلاعات از TradingView**: برای تکمیل تحلیل، داده‌های مرتبط به بازار انس طلا را از TradingView بخوانید.
3. **تحلیل بازار**: بر اساس اطلاعات دریافتی از تریدیتک ویو و داده‌های کاربر، بازار را تحلیل کن و روند رو به صعودی یا نزولی بودن در آینده رو هم در نظر بگیر. الگوها و روندهای مهم را شناسایی کنید.
4. **نتیجه‌گیری و پیش‌بینی**: بر اساس تحلیل‌ها، خلاصه‌ای از وضعیت بازار و پیش‌بینی‌های احتمالی خود را بیان کنید.
5. **بیان به زبان محاوره‌ای**: نتیجه‌گیری‌ها را به شکلی ساده و دوستانه بیان کنید.

# قالب خروجی

- پاراگراف  کوتاه و ساده
- با لحن محاوره‌ای و دوستانه به صورت پاراگراف
- اگه جایی امکان استفاده از اموجی رو داره در حد یکی دوتا استفاده کن
- قالب اعداد با حروف انگلیسی باشه و جداکننده داشته باشه

# اطلاعات تکمیلی
قیمت فعلی انس طلا: ${signal.createdOuncePrice}
`,
      },
      {
        role: 'user',
        content: `اینو آنالیز کن:
        
        ${JSON.stringify(signal)}
        `,
      },
    ];

    const result = await generateText({
      model: openai('gpt-4o'),
      messages,
    });

    // Deduct 1 gem from user
    await this.userModel
      .findByIdAndUpdate(user.id, {
        $inc: { gem: -1 },
      })
      .exec();

    this.gemLogModel.create({
      user: user.id,
      gemsUsed: 1,
      gemsBefore: currentUser.gem,
      gemsAfter: currentUser.gem - 1,
      action: GemLogAction.SignalAnalyze,
    });

    return {
      analysis: result.text,
      signal: signal,
      currentPrice: signal.createdOuncePrice,
    };
  }
}
