import { InjectModel } from '@nestjs/mongoose';
import { Signal, User, UserSchema } from '@ounce24/types';
import { Model } from 'mongoose';
import { Context } from 'telegraf';

export enum UserStateType {
  Login,
  NewSignal,
}

export type UserState<T = any> = {
  state: UserStateType;
  data?: T;
};

export class BaseBot {
  protected userStates = new Map<number, UserState>();

  constructor(private usersModel: Model<User>) {}

  setState<T>(userId: number, state: UserState<T>) {
    this.userStates.set(userId, state);
  }

  getState<T>(userId: number) {
    const state: UserState<T> = this.userStates.get(userId);
    return state;
  }

  setStateData<T>(userId: number, data: T) {
    const state = this.userStates.get(userId);
    if (state) {
      state.data = data;
      this.userStates.set(userId, state);
    }
  }

  getStateData<T>(userId: number) {
    const state: UserState<T> = this.userStates.get(userId);
    return state?.data;
  }

  async login(ctx: Context) {
    const state = this.getState<Partial<User>>(ctx.from.id);
    const dto = state?.data;
    const text = ctx.message['text'];
    if (state?.state !== UserStateType.Login) {
      this.setState(ctx.from.id, {state: UserStateType.Login});
      ctx.reply('شماره تلفن همراه خود را وارد کنید')
    }
  }

  async preCheckValid(ctx: Context) {
    const user = await this.getUser(ctx.from.id);
    if (!user) {
      this.login(ctx);
    }
  }

  getUser(telegramId: number): Promise<User> {
    return this.usersModel.findOne({ telegramId }).exec();
  }
}
