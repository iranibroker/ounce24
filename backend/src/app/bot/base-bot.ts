import { User } from '@ounce24/types';
import { Model } from 'mongoose';
import { Context } from 'telegraf';
import { PersianNumberService } from '@ounce24/utils';

export enum UserStateType {
  Login,
  NewSignal,
}

export type UserState<T = any> = {
  state: UserStateType;
  data?: T;
};

export class BaseBot {
  protected static userStates = new Map<number, UserState>();

  constructor(private usersModel: Model<User>) {}

  setState<T>(userId: number, state: UserState<T>) {
    BaseBot.userStates.set(userId, state);
  }

  getState<T>(userId: number) {
    const state: UserState<T> = BaseBot.userStates.get(userId);
    return state;
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
    ctx.reply(
      `
به ounce24 خوش‌آمدید
از دستورات زیر میتوانید استفاده کنید

/new_signal ایجاد سیگنال جدید

/my_signals مدیریت سیگنال‌های ثبت شده

/my_closed_signals لیست سیگنال‌های بسته شده

/leaderboard رنکینگ اساتید

/profile مشاهده اطلاعات کاربری و امتیاز
`,
      {
        reply_markup: {
          inline_keyboard: [],
          remove_keyboard: true,
        },
      }
    );
  }

  async login(ctx: Context) {
    const state = this.getState<Partial<User>>(ctx.from.id);
    const dto = state?.data || {
      telegramId: ctx.from.id,
      telegramUsername: ctx.from.username,
    };
    const text = ctx.message['text'];
    if (state?.state !== UserStateType.Login) {
      this.setState(ctx.from.id, { state: UserStateType.Login });
      ctx.reply('شماره تلفن همراه خود را وارد کنید');
    } else if (!dto?.phone) {
      const phone = PersianNumberService.toEnglish(text);
      if (
        isNaN(Number(phone)) ||
        phone.length !== 11 ||
        phone.search('09') !== 0
      ) {
        ctx.reply(
          'شماره همراه وارد شده صحیح نیست. لطفا به صورت کامل وارد کنید. مثلا: 09123456789'
        );
        return;
      }
      dto.phone = phone;
      ctx.reply('نام و نام خانوادگی خود را وارد کنید');
    } else if (!dto?.name) {
      dto.name = text;
      ctx.reply('نام مستعار جهت نمایش به کاربران');
    } else if (!dto?.title) {
      dto.title = text;
      const createdData = new this.usersModel(dto);
      await createdData.save();
      this.welcome(ctx);
      BaseBot.userStates.delete(ctx.from.id);
      return
    }
    this.setStateData(ctx.from.id, dto);
  }

  async isValid(ctx: Context) {
    const user = await this.getUser(ctx.from.id);
    if (!user) {
      this.login(ctx);
      return false;
    }
    return true;
  }

  getUser(telegramId: number): Promise<User> {
    return this.usersModel.findOne({ telegramId }).exec();
  }
}
