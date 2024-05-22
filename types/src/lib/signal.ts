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
  [SignalStatus.Closed]: '⏹ بسته',
  [SignalStatus.Canceled]: '⏹ بسته',
};

export const SignalTypeText = {
  [SignalType.Buy]: '🔵 خرید (buy)',
  [SignalType.Sell]: '🔴 فروش (sell)',
};

@Schema({ timestamps: true })
export class Signal {
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

  @Prop({ required: true, default: 0 })
  createdOuncePrice: number;

  @Prop()
  closedOuncePrice?: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  owner: User;

  createdAt?: Date;

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
    return `${diff < 0 ? '🟥' : '🟩'} ${diff} pip`;
  }

  static getProfit(signal: Signal) {
    const isSell = signal.type === SignalType.Sell;
    return isSell ? signal.minPrice : signal.maxPrice;
  }

  static getLoss(signal: Signal) {
    const isSell = signal.type === SignalType.Sell;
    return isSell ? signal.maxPrice : signal.minPrice;
  }

  static getMessage(signal: Signal, showId = false, ouncePrice?: number) {
    const isSell = signal.type === SignalType.Sell;
    let text = `سیگنال
${SignalTypeText[signal.type]}
به قیمت: ${signal.entryPrice}
    
❌ حد ضرر: ${this.getLoss(signal)}
✅ حد سود: ${this.getProfit(signal)}
    
وضعیت: ${SignalStatusText[signal.status]}\n`;

    if (ouncePrice && signal.status === SignalStatus.Active) {
      text += '\n' + Signal.getPipString(signal, ouncePrice);
    }

    if (showId) text += `#${signal.id}`;

    return text;
  }
}

export const SignalSchema = SchemaFactory.createForClass(Signal);
