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
  publishChannelMessageId?: number;

  @Prop()
  closedPrice?: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  owner: User;

  @Prop()
  closedAt?: Date;

  @Prop()
  deletedAt?: Date;

  static getProfit(signal: Signal) {
    const isSell = signal.type === SignalType.Sell;
    return isSell ? signal.minPrice : signal.maxPrice;
  }

  static getLoss(signal: Signal) {
    const isSell = signal.type === SignalType.Sell;
    return isSell ? signal.maxPrice : signal.minPrice;
  }

  static getMessage(signal: Signal, showId = false) {
    const isSell = signal.type === SignalType.Sell;
    return `سیگنال
${SignalTypeText[signal.type]}
به قیمت: ${signal.entryPrice}
    
❌ حد ضرر: ${this.getLoss(signal)}
✅ حد سود: ${this.getProfit(signal)}
    
وضعیت : ${SignalStatusText[signal.status]}

${showId ? '#' + signal.id : ''}`;
  }
}

export const SignalSchema = SchemaFactory.createForClass(Signal);
