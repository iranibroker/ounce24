import { User } from '@ounce24/types';
import { Model } from 'mongoose';
import { Context, Telegraf } from 'telegraf';
import { AuthService } from '../auth/auth.service';
import { Command, Ctx, Action } from 'nestjs-telegraf';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { getTranslation, LANGUAGE_DISPLAY_NAMES } from './i18n';

const APP_URL = process.env.APP_URL || 'https://app.ounce24.com';
const MAIN_CHANNEL_URL =
  process.env.MAIN_CHANNEL_URL || 'https://t.me/Ounce24_signal';
const LIVE_MARKET_URL =
  process.env.LIVE_MARKET_URL || 'https://t.me/Ounce24';

export enum UserStateType {
  Login,
  Otp,
  NewSignal,
  Support,
  Iban,
  SendMessageToAll,
  SearchUser,
  Consulting,
  OunceAlarm,
}

export type UserState<T = any> = {
  state: UserStateType;
  data?: T;
};

export class BaseBot {
  protected static userStates = new Map<number, UserState>();

  constructor(
    private usersModel: Model<User>,
    private authService: AuthService,
    private botService: Telegraf<Context>,
  ) {}

  setState<T>(userId: number, state: UserState<T>) {
    BaseBot.userStates.set(userId, state);
  }

  getState<T>(userId: number) {
    const state: UserState<T> = BaseBot.userStates.get(userId);
    return state;
  }

  deleteState(userId: number) {
    BaseBot.userStates.delete(userId);
  }

  setStateData<T>(userId: number, data: T) {
    const state = BaseBot.userStates.get(userId);
    if (state) {
      state.data = data;
      BaseBot.userStates.set(userId, state);
    }
  }

  getStateData<T>(userId: number) {
    const state: UserState<T> = BaseBot.userStates.get(userId);
    return state?.data;
  }

  async getUserLang(telegramId: number): Promise<string> {
    const user = await this.usersModel.findOne({ telegramId }).exec();
    return user?.language || 'en';
  }

  async welcome(ctx: Context) {
    const count = await this.usersModel.countDocuments().exec();
    BaseBot.userStates.delete(ctx.from.id);
    const lang = await this.getUserLang(ctx.from.id);
    const t = getTranslation(lang);
    ctx.reply(
      t.welcome(count),
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: t.buttons.webApp,
                style: 'primary',
                web_app: { url: APP_URL },
              } as InlineKeyboardButton,
            ],
            [
              {
                text: t.buttons.signalChannel,
                callback_data: 'signal_channel',
              },
              {
                text: t.buttons.liveMarket,
                url: LIVE_MARKET_URL,
              },
            ],
            [{ text: t.buttons.newSignal, callback_data: 'new_signal' }],
            [
              {
                text: t.buttons.closedSignals,
                callback_data: 'my_closed_signals',
              },
              { text: t.buttons.mySignals, callback_data: 'my_signals' },
            ],
            [
              {
                text: t.buttons.leaderboard,
                callback_data: 'leaderboard',
              },
            ],
            [
              {
                text: t.buttons.profileScore,
                callback_data: 'profile',
              },
            ],
            [
              {
                text: t.buttons.myAlarms,
                callback_data: 'my_alarms',
              },
              {
                text: t.buttons.priceAlarm,
                callback_data: 'alarm_me',
              },
            ],
            [
              {
                text: t.buttons.aiPodcast,
                callback_data: 'podcast',
              },
            ],
            [{ text: t.buttons.goldChart, callback_data: 'charts' }],
            [
              {
                text: t.buttons.missionRisk,
                callback_data: 'risk_mission',
              },
              {
                text: t.buttons.aboutUs,
                callback_data: 'about_us',
              },
            ],
            [
              {
                text: t.buttons.support,
                callback_data: 'support',
              },
            ],
            [
              {
                text: t.buttons.language,
                callback_data: 'set_language',
              },
            ],
          ],
          remove_keyboard: true,
        },
      },
    );
  }

  async welcomeSignal(ctx: Context) {
    BaseBot.userStates.delete(ctx.from.id);
    const lang = await this.getUserLang(ctx.from.id);
    const t = getTranslation(lang);
    ctx.reply(
      t.welcomeSignalMenu,
      {
        reply_markup: {
          inline_keyboard: [],
          remove_keyboard: true,
        },
      },
    );
  }

  async login(ctx: Context) {
    // Create user from Telegram ID (no phone required)
    await this.authService.findOrCreateUserByTelegram(ctx.from.id, ctx.from);
    this.welcome(ctx);
  }

  async isValid(ctx: Context) {
    const user = await this.getUser(ctx.from.id);
    if (!user) {
      this.login(ctx);
      return false;
    }
    const chatMember = await this.botService.telegram.getChatMember(
      process.env.PUBLISH_CHANNEL_ID,
      user.telegramId,
    );
    if (
      chatMember?.status != 'member' &&
      chatMember?.status != 'creator' &&
      chatMember?.status != 'administrator'
    ) {
      const lang = user.language || 'en';
      const t = getTranslation(lang);
      ctx.reply(t.joinChannelRequired);
      return false;
    }
    return true;
  }

  getUser(telegramId: number): Promise<User> {
    return this.usersModel.findOne({ telegramId }).exec();
  }

  getPrevSundayAt21() {
    const date = this.getLastSundayAt21();
    date.setDate(date.getDate() - 7);
    return date;
  }

  getLastSundayAt21() {
    const currentDate = new Date();
    const gmtDate = new Date(
      currentDate.getTime() + currentDate.getTimezoneOffset() * 60000,
    );
    // Get the current day of the week (0 - Sunday, 1 - Monday, etc.)
    const dayOfWeek = gmtDate.getUTCDay();

    // Calculate the last Sunday
    const lastSunday = new Date(gmtDate);
    lastSunday.setUTCDate(
      gmtDate.getUTCDate() -
        (dayOfWeek === 0 && gmtDate.getHours() < 21 ? 7 : dayOfWeek),
    ); // Move to the previous Sunday
    lastSunday.setUTCHours(21, 0, 0, 0); // Set the time to 21:00 (9:00 PM) GMT
    return lastSunday;
  }

  @Command('podcast')
  @Action('podcast')
  async podcast(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const lang = await this.getUserLang(ctx.from.id);
    const t = getTranslation(lang);
    await ctx.reply(
      t.podcastText,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: t.podcastChannel,
                url: MAIN_CHANNEL_URL,
              },
            ],
          ],
        },
      },
    );
    ctx.answerCbQuery();
  }

  @Action('signal_channel')
  async signalChannel(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const minScore = process.env.MIN_SIGNAL_SCORE || '20';
    const lang = await this.getUserLang(ctx.from.id);
    const t = getTranslation(lang);
    await ctx.reply(
      t.signalChannelPolicy(minScore),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: t.joinSignalChannel,
                url: MAIN_CHANNEL_URL,
              },
            ],
          ],
        },
      },
    );
    ctx.answerCbQuery();
  }

  @Action('risk_mission')
  async riskMission(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const lang = await this.getUserLang(ctx.from.id);
    const t = getTranslation(lang);
    await ctx.reply(t.riskWarning, { parse_mode: 'HTML' });
    ctx.answerCbQuery();
  }

  @Action('about_us')
  async aboutUs(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const lang = await this.getUserLang(ctx.from.id);
    const t = getTranslation(lang);
    await ctx.reply(t.aboutUs, { parse_mode: 'HTML' });
    ctx.answerCbQuery();
  }

  @Command('language')
  @Action('set_language')
  async languageSelector(@Ctx() ctx: Context) {
    if (!(await this.isValid(ctx))) return;
    const lang = await this.getUserLang(ctx.from.id);
    const t = getTranslation(lang);
    await ctx.reply(t.selectLanguage, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🇺🇸 English', callback_data: 'set_bot_lang:::en' },
            { text: '🇮🇷 فارسی', callback_data: 'set_bot_lang:::fa' },
          ],
          [
            { text: '🇸🇦 العربية', callback_data: 'set_bot_lang:::ar' },
            { text: '🇹🇷 Türkçe', callback_data: 'set_bot_lang:::tr' },
          ],
        ],
      },
    });
    ctx.answerCbQuery?.();
  }
}
