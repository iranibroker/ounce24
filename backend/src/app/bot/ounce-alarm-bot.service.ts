import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '@ounce24/types';
import { Model } from 'mongoose';
import { Action, Command, Ctx, InjectBot, Update } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { OnEvent } from '@nestjs/event-emitter';

import {
  OunceAlarmPayload,
  OunceAlarmsService,
} from '../ounce-alarms/ounce-alarms.service';
import { AuthService } from '../auth/auth.service';
import { Public } from '../auth/public.decorator';
import { BaseBot, UserStateType } from './base-bot';
import { EVENTS } from '../consts';
import { PersianNumberService } from '@ounce24/utils';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { OuncePriceService } from '../ounce-price/ounce-price.service';

const MAX_ALARMS_PER_USER = process.env.MAX_ALARMS_PER_USER
  ? Number(process.env.MAX_ALARMS_PER_USER)
  : 2;

@Public()
@Injectable()
@Update()
export class OunceAlarmBotService extends BaseBot {
  private readonly logger = new Logger(OunceAlarmBotService.name);

  constructor(
    @InjectBot('main') private readonly bot: Telegraf<Context>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly auth: AuthService,
    private readonly ounceAlarmsService: OunceAlarmsService,
    private readonly ouncePriceService: OuncePriceService,
  ) {
    super(userModel, auth, bot);
  }

  @Command('alarm_me')
  @Action('alarm_me')
  async handleAlarmCommand(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;

    const user = await this.getUser(ctx.from.id);
    if (!user) {
      await ctx.reply('کاربر یافت نشد. لطفا دوباره تلاش کنید.');
      return;
    }

    if (await this.ounceAlarmsService.isUserHasMaxAlarms(user.id)) {
      await ctx.reply(
        `شما به حداکثر تعداد هشدار قیمت مجاز (${MAX_ALARMS_PER_USER}) رسیده اید. برای مدیریت هشدارهای خود، /my_alarms را ارسال کنید`,
      );
      return;
    }

    this.setState(ctx.from.id, { state: UserStateType.OunceAlarm });

    await ctx.reply(
      `عدد مورد نظر خود برای ایجاد هشدار قیمت به دلار وارد کنید (مثال: 2450.5). قیمت فعلی انس طلا ${this.ouncePriceService.current} است\n/cancel`,
      {
        reply_markup: { remove_keyboard: true },
      },
    );
  }

  async handleTargetPrice(ctx: Context) {
    if (!(await this.isValid(ctx))) return;

    const rawText = ctx.message['text'] ?? '';
    const normalized = PersianNumberService.toEnglish(rawText)
      .replace(/,/g, '')
      .trim();
    const targetPrice = Number(normalized);

    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      await ctx.reply(
        'عدد وارد شده معتبر نیست. لطفا یک مقدار مثبت مانند 2405 یا 2500.75 ارسال کنید.',
      );
      return;
    }

    const user = await this.getUser(ctx.from.id);
    if (!user) {
      await ctx.reply('کاربر یافت نشد. لطفا دوباره تلاش کنید.');
      return;
    }

    try {
      await ctx.sendChatAction('typing');
      await this.ounceAlarmsService.createAlarm(user.id, targetPrice);
      await ctx.reply(
        `هشدار قیمت ${targetPrice} برای شما ثبت شد. به محض رسیدن قیمت به این مقدار به شما اطلاع می‌دهیم.\n\n/my_alarms - مدیریت هشدارهای خود\n/alarm_me - ایجاد هشدار جدید`,
      );
      this.deleteState(ctx.from.id);
    } catch (error) {
      await ctx.reply(
        'در ثبت هشدار مشکلی پیش آمد. لطفا دوباره تلاش کنید یا کمی بعد امتحان کنید.',
      );
    }
  }

  @Command('my_alarms')
  @Action('my_alarms')
  async showAlarms(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }

    const user = await this.getUser(ctx.from.id);
    if (!user) {
      await ctx.reply('کاربر یافت نشد. لطفا دوباره تلاش کنید.');
      return;
    }

    const alarms = await this.ounceAlarmsService.getAlarmsByUser(user.id);
    if (alarms.length === 0) {
      await ctx.reply('هیچ هشداری برای شما ثبت نشده است.');
      return;
    }

    const inline_keyboard = this.buildAlarmsKeyboard(alarms);
    await ctx.reply('لیست هشدارهای شما:', {
      reply_markup: {
        inline_keyboard,
      },
    });
  }

  @Action(/^alarm_delete::.+$/)
  async handleAlarmRemoval(@Ctx() ctx: Context) {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) {
      await ctx.answerCbQuery('داده هشدار یافت نشد.');
      return;
    }

    const callbackData = callbackQuery.data ?? '';
    const targetPart = callbackData.split('::')[1];
    const targetPrice = Number(targetPart);

    if (!Number.isFinite(targetPrice)) {
      await ctx.answerCbQuery('فرمت هشدار نامعتبر است.');
      return;
    }

    const user = await this.getUser(ctx.from.id);
    if (!user) {
      await ctx.answerCbQuery('کاربر یافت نشد.');
      return;
    }

    const removed = await this.ounceAlarmsService.cancelAlarm(
      user.id,
      targetPrice,
    );
    if (!removed) {
      await ctx.answerCbQuery('حذف هشدار با خطا مواجه شد.');
      return;
    }

    const updatedAlarms = await this.ounceAlarmsService.getAlarmsByUser(
      user.id,
    );
    if (updatedAlarms.length === 0) {
      await ctx.editMessageText('همه هشدارهای شما حذف شدند.');
      await ctx.answerCbQuery('هشدار حذف شد.');
      return;
    }

    const inline_keyboard = this.buildAlarmsKeyboard(updatedAlarms);
    await ctx.editMessageReplyMarkup({
      inline_keyboard,
    });
    await ctx.answerCbQuery('هشدار حذف شد.');
  }

  @OnEvent(EVENTS.OUNCE_ALARM_TRIGGERED)
  async notifyUser(payload: OunceAlarmPayload) {
    try {
      const user = await this.userModel.findById(payload.userId).exec();
      if (!user?.telegramId) {
        return;
      }

      await this.bot.telegram.sendMessage(
        user.telegramId,
        `🎯 هشدار قیمت شما فعال شد!\nقیمت اونس به ${payload.targetPrice} رسید.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to notify user about triggered alarm`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private buildAlarmsKeyboard(
    alarms: OunceAlarmPayload[],
  ): InlineKeyboardButton[][] {
    return alarms.map((alarm) => [
      {
        text: `🎯 ${alarm.targetPrice} - حذف هشدار`,
        callback_data: `alarm_delete::${alarm.targetPrice}`,
      },
    ]);
  }

  @Command('temp_alaram_message')
  @Action('temp_alaram_message')
  async tempAlaramMessage(@Ctx() ctx: Context) {
    this.bot.telegram.sendMessage(
      process.env.PUBLISH_CHANNEL_ID,
      `فعالسازی هشدار در قیمت دلخواه!


با استفاده از قابلیت «هشدار قیمت» در ربات انس24، می‌توانید عدد دلخواه خود را برای قیمت انس طلا تنظیم کنید تا هنگام رسیدن قیمت به آن مقدار، به شما اطلاع داده شود.

ربات انس24 :
@ounce24_bot
`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'هشدار قیمت', url: process.env.MAIN_CHANNEL_URL }],
          ],
        },
      },
    );
  }
}
