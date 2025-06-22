import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Signal, SignalSource, SignalStatus, User } from '@ounce24/types';
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
3. **تحلیل بازار**: بر اساس اطلاعات دریافتی و داده‌های کاربر، بازار را تحلیل کنید. الگوها و روندهای مهم را شناسایی کنید.
4. **نتیجه‌گیری و پیش‌بینی**: بر اساس تحلیل‌ها، خلاصه‌ای از وضعیت بازار و پیش‌بینی‌های احتمالی خود را بیان کنید.
5. **بیان به زبان محاوره‌ای**: نتیجه‌گیری‌ها را به شکلی ساده و دوستانه بیان کنید.

# قالب خروجی

- پاراگراف  کوتاه و ساده
- با لحن محاوره‌ای و دوستانه به صورت پاراگراف
- اگه جایی امکان استفاده از اموجی رو داره در حد یکی دوتا استفاده کن
- قالب اعداد با حروف انگلیسی باشه و جداکننده داشته باشه
`,
      },
      {
        role: 'user',
        content: `اینو آنالیز کن:
        
        ${JSON.stringify(signal)}
        Current Gold Price: ${signal.createdOuncePrice}
        `,
      },
    ];

    const result = await generateText({
      model: openai('gpt-4o'),
      messages,
    });

    return {
      analysis: result.text,
      signal: signal,
      currentPrice: signal.createdOuncePrice,
    };
  }
}
