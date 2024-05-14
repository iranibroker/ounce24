import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

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

@Schema({ timestamps: true })
export class Signal {
  // @Prop({type: 'ObjectId', index: true, auto: true})
  // id: number;
  ـid: string;

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
  closedPrice?: number;

  @Prop()
  closedAt?: Date;

  static getMessage(signal: Signal) {
    const isSell = signal.type === SignalType.Sell;
    return `سیگنال 
${isSell ? '🔴 فروش (sell)' : '🔵 خرید (buy)'} به قیمت : ${signal.entryPrice}
    
✅حد سود: ${isSell ? signal.maxPrice : signal.minPrice}
❌حد ضرر: ${isSell ? signal.minPrice : signal.maxPrice}
    
وضعیت :  ⛳️کاشته شده`;
  }
}

export const SignalSchema = SchemaFactory.createForClass(Signal);
