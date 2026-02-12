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
      await ctx.reply('User not found. Please try again.');
      return;
    }

    if (await this.ounceAlarmsService.isUserHasMaxAlarms(user.id)) {
      await ctx.reply(
        `You've reached the max number of price alarms (${MAX_ALARMS_PER_USER}). Use /my_alarms to manage them`,
      );
      return;
    }

    this.setState(ctx.from.id, { state: UserStateType.OunceAlarm });

    await ctx.reply(
      `Enter the price (in USD) for your alarm. Current gold price: ${this.ouncePriceService.current}\n/cancel`,
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
        'Invalid value. Please send a positive number, e.g. 2405 or 2500.75',
      );
      return;
    }

    const user = await this.getUser(ctx.from.id);
    if (!user) {
      await ctx.reply('User not found. Please try again.');
      return;
    }

    try {
      await ctx.sendChatAction('typing');
      await this.ounceAlarmsService.createAlarm(user.id, targetPrice);
      await ctx.reply(
        `Price alarm set at ${targetPrice}. We'll notify you when price reaches it.\n\n/my_alarms - Manage alarms\n/alarm_me - New alarm`,
      );
      this.deleteState(ctx.from.id);
    } catch (error) {
      await ctx.reply(
        'Something went wrong saving the alarm. Please try again later.',
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
      await ctx.reply('User not found. Please try again.');
      return;
    }

    const alarms = await this.ounceAlarmsService.getAlarmsByUser(user.id);
    if (alarms.length === 0) {
      await ctx.reply('You have no price alarms set.');
      return;
    }

    const inline_keyboard = this.buildAlarmsKeyboard(alarms);
    await ctx.reply('Your alarms:', {
      reply_markup: {
        inline_keyboard,
      },
    });
  }

  @Action(/^alarm_delete::.+$/)
  async handleAlarmRemoval(@Ctx() ctx: Context) {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) {
      await ctx.answerCbQuery('Alarm data not found.');
      return;
    }

    const callbackData = callbackQuery.data ?? '';
    const targetPart = callbackData.split('::')[1];
    const targetPrice = Number(targetPart);

    if (!Number.isFinite(targetPrice)) {
      await ctx.answerCbQuery('Invalid alarm format.');
      return;
    }

    const user = await this.getUser(ctx.from.id);
    if (!user) {
      await ctx.answerCbQuery('User not found.');
      return;
    }

    const removed = await this.ounceAlarmsService.cancelAlarm(
      user.id,
      targetPrice,
    );
    if (!removed) {
      await ctx.answerCbQuery('Failed to remove alarm.');
      return;
    }

    const updatedAlarms = await this.ounceAlarmsService.getAlarmsByUser(
      user.id,
    );
    if (updatedAlarms.length === 0) {
      await ctx.editMessageText('All your alarms have been removed.');
      await ctx.answerCbQuery('Alarm removed.');
      return;
    }

    const inline_keyboard = this.buildAlarmsKeyboard(updatedAlarms);
    await ctx.editMessageReplyMarkup({
      inline_keyboard,
    });
    await ctx.answerCbQuery('Alarm removed.');
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
        `🎯 Your price alarm triggered!\nGold reached ${payload.targetPrice}.`,
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
        text: `🎯 ${alarm.targetPrice} - Remove alarm`,
        callback_data: `alarm_delete::${alarm.targetPrice}`,
      },
    ]);
  }

  @Command('temp_alaram_message')
  @Action('temp_alaram_message')
  async tempAlaramMessage(@Ctx() ctx: Context) {
    this.bot.telegram.sendMessage(
      -1001924183136,
      `Set a price alarm!


Use the "Price alarm" feature in Ounce24 bot to set your target gold price. We'll notify you when price reaches it.

Ounce24 bot:
@ounce24_bot`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Price alarm',
                url: process.env.MAIN_CHANNEL_URL + '_bot',
              },
            ],
          ],
        },
      },
    );
  }
}
