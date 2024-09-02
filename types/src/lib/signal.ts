import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from './user';

export type SignalDocument = HydratedDocument<Signal>;

export enum SignalType {
  Buy = 'BUY',
  Sell = 'SELL',
}

export enum SignalStatus {
  Pending = 'PENDING',
  Active = 'ACTIVE',
  Closed = 'CLOSED',
  Canceled = 'CANCELED',
}

export const SignalStatusText = {
  [SignalStatus.Pending]: '⛳️ کاشته شده',
  [SignalStatus.Active]: '▶️ فعال',
  [SignalStatus.Closed]: '🎯 بسته',
  [SignalStatus.Canceled]: '🚫 لغو شده',
};

export const SignalTypeText = {
  [SignalType.Buy]: '🔵 خرید (buy)',
  [SignalType.Sell]: '🔴 فروش (sell)',
};

@Schema({ timestamps: true })
export class Signal {
  _id: any;
  id: string;

  @Prop({ required: true, enum: SignalType })
  type: SignalType;

  @Prop({ required: true, enum: SignalStatus, default: SignalStatus.Pending })
  status: SignalStatus;

  @Prop({ required: true })
  entryPrice: number;

  @Prop({ required: true })
  maxPrice: number;

  @Prop({ required: true })
  minPrice: number;

  @Prop()
  messageId?: number;

  @Prop({ default: false })
  publishable?: boolean;

  @Prop({ default: false })
  riskFree?: boolean;

  @Prop()
  telegramBot?: string;

  @Prop({ required: true, default: 0 })
  createdOuncePrice: number;

  @Prop()
  closedOuncePrice?: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  owner: User;

  createdAt?: Date;

  @Prop()
  activeAt?: Date;

  @Prop()
  closedAt?: Date;

  @Prop()
  deletedAt?: Date;

  //virtual props
  isSell: boolean;
  profit: number;
  loss: number;
  pip: number | null;
  riskReward: number;
  score: number;

  static activeTrigger(signal: Signal, ouncePrice: number) {
    if (
      signal.entryPrice === signal.createdOuncePrice &&
      signal.createdOuncePrice !== ouncePrice
    )
      return true;
    const min = Math.min(signal.createdOuncePrice, ouncePrice);
    const max = Math.max(signal.createdOuncePrice, ouncePrice);
    return signal.entryPrice > min && signal.entryPrice < max;
  }

  static closeTrigger(signal: Signal, ouncePrice: number) {
    if (signal.riskFree) {
      if (
        (signal.isSell && ouncePrice >= signal.entryPrice) ||
        (!signal.isSell && ouncePrice <= signal.entryPrice)
      )
        return true;
    }
    return ouncePrice > signal.maxPrice || ouncePrice < signal.minPrice;
  }

  static getActivePip(signal: Signal, ouncePrice: number) {
    const isSell = signal.type === SignalType.Sell;
    const diff = isSell
      ? signal.entryPrice - ouncePrice
      : ouncePrice - signal.entryPrice;
    return Number((diff * 10).toFixed(3));
  }

  static getPipString(signal: Signal, ouncePrice?: number) {
    const diff = ouncePrice
      ? Signal.getActivePip(signal, ouncePrice)
      : signal.pip;
    return `${diff < 0 ? '🟥' : '🟩'} ${diff} pip ${diff < 0 ? 'ضرر' : 'سود'}`;
  }

  static filterWinSignals(signals: Signal[]) {
    return signals.filter(
      (signal) =>
        signal.status === SignalStatus.Closed &&
        Signal.getActivePip(signal, signal.closedOuncePrice) >= 0
    );
  }

  static getStatsText(signals: Signal[]) {
    const rewardSignals = signals.filter((s) => s.pip >= 0);
    const rewardAvg = rewardSignals.reduce((value, signal) => {
      return signal.riskReward / rewardSignals.length + value;
    }, 0);

    const scoreSum = signals.reduce((value, signal) => {
      return signal.score + value;
    }, 0);

    return `تعداد سیگنال: ${signals.length}
وین ریت: ${Math.round(
      (Signal.filterWinSignals(signals).length / signals.length) * 100
    )}%
میانگین ریسک-ریوارد: ${rewardAvg.toFixed(1)}
امتیاز: ${scoreSum.toFixed(1)}
    `;
  }

  static getMessage(
    signal: Signal,
    options?: {
      showId?: boolean;
      ouncePrice?: number;
      signals?: Signal[];
    }
  ) {
    let text = `سیگنال
${SignalTypeText[signal.type]}
به قیمت: ${signal.entryPrice}

❌ حد ضرر: ${signal.loss}
✅ حد سود: ${signal.profit}

ریسک-ریوارد: ${signal.riskReward.toFixed(1)}\n`;

    if (signal.status === SignalStatus.Closed)
      text += `امتیاز: ${signal.score.toFixed(1)}\n`;

    text += `\nوضعیت: ${SignalStatusText[signal.status]}\n`;

    if (signal.riskFree) text += `🚧 ریسک فری\n`;

    if (signal.status === SignalStatus.Closed && signal.closedOuncePrice) {
      text += `قیمت لحظه بسته شدن: ${signal.closedOuncePrice}`;
    }

    if (options?.ouncePrice && signal.status === SignalStatus.Active) {
      text += '\n' + Signal.getPipString(signal, options?.ouncePrice);
    } else if (
      signal.status === SignalStatus.Closed &&
      signal.closedOuncePrice
    ) {
      text += '\n' + Signal.getPipString(signal);
    }

    if (signal.owner) {
      text += `\n\n👤 ${signal.owner.tag}`;
    }

    if (options?.signals?.length) {
      text += `\n` + Signal.getStatsText(options.signals);
    }

    if (options?.showId) text += `\n\n\n^^${signal.id}`;

    return text;
  }
}

export const SignalSchema = SchemaFactory.createForClass(Signal);

SignalSchema.virtual('isSell').get(function () {
  return this.type === SignalType.Sell;
});
SignalSchema.virtual('profit').get(function () {
  return this.isSell ? this.minPrice : this.maxPrice;
});
SignalSchema.virtual('loss').get(function () {
  return this.isSell ? this.maxPrice : this.minPrice;
});
SignalSchema.virtual('pip').get(function () {
  if (this.status === SignalStatus.Closed && this.closedOuncePrice) {
    const diff = this.isSell
      ? this.entryPrice - this.closedOuncePrice
      : this.closedOuncePrice - this.entryPrice;
    const pip = Number((diff * 10).toFixed(3));
    return this.riskFree && pip < 0 ? 0 : pip;
  }
  return null;
});
SignalSchema.virtual('riskReward').get(function () {
  if (this.pip === 0) return 0;
  const profit = this.pip > 0 ? this.closedOuncePrice : this.profit;
  const riskReward = Math.abs(
    (profit - this.entryPrice) / (this.loss - this.entryPrice)
  );
  return this.status === SignalStatus.Closed && this.pip < 0 && this.riskFree
    ? 0
    : riskReward;
});
SignalSchema.virtual('score').get(function () {
  if (this.status === SignalStatus.Closed) {
    const lossPip = Math.abs(this.loss - this.entryPrice) * 10;
    const pip = this.pip;
    const res = (pip / lossPip) * (Math.abs(pip) / (pip < 0 ? 10 : 50) + 10);
    return res;
  }

  return 0;
});
