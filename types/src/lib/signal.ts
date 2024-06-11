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

  static activeTrigger(signal: Signal, ouncePrice: number) {
    const min = Math.min(signal.createdOuncePrice, ouncePrice);
    const max = Math.max(signal.createdOuncePrice, ouncePrice);
    return signal.entryPrice > min && signal.entryPrice < max;
  }

  static getPip(signal: Signal, ouncePrice: number) {
    const isSell = signal.type === SignalType.Sell;
    const diff = isSell
      ? signal.entryPrice - ouncePrice
      : ouncePrice - signal.entryPrice;
    return Number((diff * 10).toFixed(3));
  }

  static getPipString(signal: Signal, ouncePrice: number) {
    const diff = Signal.getPip(signal, ouncePrice);
    return `${diff < 0 ? '🟥' : '🟩'} ${diff} pip ${diff < 0 ? 'ضرر' : 'سود'}`;
  }

  static getProfit(signal: Signal) {
    const isSell = signal.type === SignalType.Sell;
    return isSell ? signal.minPrice : signal.maxPrice;
  }

  static getLoss(signal: Signal) {
    const isSell = signal.type === SignalType.Sell;
    return isSell ? signal.maxPrice : signal.minPrice;
  }

  static getRiskReward(signal: Signal) {
    return Math.abs(
      (Signal.getProfit(signal) - signal.entryPrice) /
        (Signal.getLoss(signal) - signal.entryPrice)
    );
  }

  static filterWinSignals(signals: Signal[]) {
    return signals.filter(
      (signal) =>
        signal.status === SignalStatus.Closed &&
        Signal.getPip(signal, signal.closedOuncePrice) >= 0
    );
  }

  static getStatsText(signals: Signal[]) {
    const rewardAvg = signals.reduce((value, signal) => {
      const riskReward = Signal.getRiskReward(signal);
      return riskReward / signals.length + value;
    }, 0);

    return `تعداد سیگنال: ${signals.length}
وین ریت: ${Math.round(
      (Signal.filterWinSignals(signals).length / signals.length) * 100
    )}%
میانگین ریسک-ریوارد: ${rewardAvg.toFixed(1)}
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

❌ حد ضرر: ${this.getLoss(signal)}
✅ حد سود: ${this.getProfit(signal)}

ریسک-ریوارد: ${Signal.getRiskReward(signal).toFixed(1)}
    
وضعیت: ${SignalStatusText[signal.status]}\n`;

    if (options?.ouncePrice && signal.status === SignalStatus.Active) {
      text += '\n' + Signal.getPipString(signal, options?.ouncePrice);
    } else if (
      signal.status === SignalStatus.Closed &&
      signal.closedOuncePrice
    ) {
      text += '\n' + Signal.getPipString(signal, signal.closedOuncePrice);
    }

    if (signal.owner) {
      text += `\n\n👤${signal.owner.name}`;
    }

    if (options?.signals) {
      text += `\n` + Signal.getStatsText(options.signals);
    }

    if (options?.showId) text += `\n#${signal.id}`;

    return text;
  }
}

export const SignalSchema = SchemaFactory.createForClass(Signal);
