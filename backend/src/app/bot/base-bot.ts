import { User } from '@ounce24/types';
import { Model } from 'mongoose';
import { Context, Telegraf } from 'telegraf';
import { AuthService } from '../auth/auth.service';
import { Command, Ctx, Action } from 'nestjs-telegraf';

const APP_URL = process.env.APP_URL || 'https://app.ounce24.com';
const MAIN_CHANNEL_URL =
  process.env.MAIN_CHANNEL_URL || 'https://t.me/Ounce24_signal';

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

  async welcome(ctx: Context) {
    const count = await this.usersModel.countDocuments().exec();
    BaseBot.userStates.delete(ctx.from.id);
    ctx.reply(
      `
Hi, I'm Ounce24
Use the options below to get started.
If you get stuck, use the menu button.

We've launched a new app for a better experience.

Bot members: ${count}
`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Ounce24 Telegram Channel',
                url: MAIN_CHANNEL_URL,
              },
            ],
            [{ text: '➕ New signal', callback_data: 'new_signal' }],
            [
              {
                text: '🎯 Closed',
                callback_data: 'my_closed_signals',
              },
              { text: '⛳️▶️ My signals', callback_data: 'my_signals' },
            ],
            [
              {
                text: 'Leaderboard',
                callback_data: 'leaderboard',
              },
            ],
            [
              {
                text: 'Profile & score',
                callback_data: 'profile',
              },
            ],
            [
              {
                text: 'My alarms',
                callback_data: 'my_alarms',
              },
              {
                text: '🔔 Price alarm',
                callback_data: 'alarm_me',
              },
            ],
            [
              {
                text: '🎙️ AI analysis podcast',
                callback_data: 'podcast',
              },
            ],
            [{ text: 'Gold chart', callback_data: 'charts' }],
            [
              {
                text: 'Support',
                callback_data: 'support',
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
    ctx.reply(
      `
/new_signal Create new signal

/my_signals Manage your signals

/my_closed_signals Closed signals list

/charts Gold chart

/leaderboard Overall leaderboard

/leaderboard_week Weekly leaderboard

/support Support & feedback

/bank - Register bank IBAN

/profile View profile & score

/reset_all_profile Reset signal history (start over)
`,
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
      ctx.reply(`
Please join the channel below to use the bot.

@Ounce24_signal
  `);
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
    await ctx.reply(
      `Our weekly podcasts are ~20 minute audio files with a detailed review of the past week and outlook for the week ahead. 📈
      
      Content is based on the latest trusted sources and analyzed with AI in a data-driven way. 🤖
      
      Podcasts are published weekly on the official Ounce24 channel. Join the channel and check the Music section for the full list. 🎧`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Ounce24 Channel',
                url: MAIN_CHANNEL_URL,
              },
            ],
          ],
        },
      },
    );
    ctx.answerCbQuery();
  }
}
