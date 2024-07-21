import { User } from '@ounce24/types';
import { Model } from 'mongoose';
import { Context, Telegraf } from 'telegraf';
import { PersianNumberService } from '@ounce24/utils';
import { AuthService } from '../auth/auth.service';

export enum UserStateType {
  Login,
  Otp,
  NewSignal,
  Support,
  Iban,
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
    private botService: Telegraf<Context>
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
سلام من انس 24 ام
از گزینه های زیر میتونی استفاده کنی
هرجا گیرکردی از گزینه menu کنار استفاده کن


/new_signal ایجاد سیگنال جدید

/my_signals مدیریت سیگنال‌های ثبت شده

/my_closed_signals لیست سیگنال‌های بسته شده

/leaderboard رنکینگ کلی اساتید

/leaderboard_week رنکینگ هفتگی اساتید

/support پشتیبانی و ارسال نظر

/profile مشاهده اطلاعات کاربری و امتیاز

/reset_all_profile پاک کردن تاریخچه سیگنال ها (شروع دوباره)



تعداد اعضای متصل به ربات: ${count} نفر
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

    if (state?.state === UserStateType.Otp && dto.phone) {
      const token = PersianNumberService.toEnglish(text);
      const isOk = this.authService.checkToken(dto.phone, token);
      if (!isOk) {
        ctx.reply('کد وارد شده نادرست است. لطفا کد صحیح را وارد کنید');
        return;
      } else {
        state.state = UserStateType.Login;
        this.setState(ctx.from.id, state);
        if (!dto.name) {
          ctx.reply(`لطفا نام و نام خانوادگی خود را وارد کنید`);
          return;
        }
        if (!dto.title) {
          ctx.reply(`نام مستعار جهت نمایش به کاربران را وارد کنید`);
          return;
        }
      }
    }

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
      const user = await this.authService.sendToken(phone);
      if (user) {
        dto.id = user.id;
        dto.name = user.name;
        dto.title = user.title;
      }
      ctx.reply('یک کد عددی برای شما پیامک شد لطفا آن را وارد کنید');
      state.state = UserStateType.Otp;
      state.data = dto;
      this.setState(ctx.from.id, state);
      return;
    } else if (!dto?.name) {
      dto.name = text;
      ctx.reply('نام مستعار جهت نمایش به کاربران را وارد کنید');
    } else if (!dto?.title) {
      const exist = await this.usersModel.findOne({ title: text }).exec();
      if (exist) {
        ctx.reply(
          'نام انتخاب شده به شخص دیگری متعلق است. لطفا یک نام مستعار جدید انتخاب کنید'
        );
        return;
      }
      dto.title = text;
    }
    if ((dto.name, dto.phone, dto.title)) {
      if (dto.id) {
        await this.usersModel.findByIdAndUpdate(dto.id, dto).exec();
      } else {
        const createdData = new this.usersModel(dto);
        await createdData.save();
      }
      this.welcome(ctx);
      return;
    }
    this.setStateData(ctx.from.id, dto);
  }

  async isValid(ctx: Context) {
    const user = await this.getUser(ctx.from.id);
    if (!user) {
      this.login(ctx);
      return false;
    }
    const chatMember = await this.botService.telegram.getChatMember(
      process.env.PUBLISH_CHANNEL_ID,
      user.telegramId
    );
    if (
      chatMember?.status != 'member' &&
      chatMember?.status != 'creator' &&
      chatMember?.status != 'administrator'
    ) {
      ctx.reply(`
برای استفاده از خدمات ربات ابتدا در کانال زیر عضو شوید.

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
      currentDate.getTime() + currentDate.getTimezoneOffset() * 60000
    );
    // Get the current day of the week (0 - Sunday, 1 - Monday, etc.)
    const dayOfWeek = gmtDate.getUTCDay();

    // Calculate the last Sunday
    const lastSunday = new Date(gmtDate);
    lastSunday.setUTCDate(
      gmtDate.getUTCDate() -
        (dayOfWeek === 0 && gmtDate.getHours() < 21 ? 7 : 0)
    ); // Move to the previous Sunday
    lastSunday.setUTCHours(21, 0, 0, 0); // Set the time to 21:00 (9:00 PM) GMT

    return lastSunday;
  }
}
