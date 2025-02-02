import { Signal, SignalStatus, SignalType } from '@ounce24/types';
import mongoose from 'mongoose';

export const SignalSchema = new mongoose.Schema<Signal>(
  {
    type: { type: String, enum: SignalType, required: true },
    status: {
      type: String,
      enum: SignalStatus,
      required: true,
      default: SignalStatus.Pending,
    },
    entryPrice: { type: Number, required: true },
    maxPrice: { type: Number, required: true },
    minPrice: { type: Number, required: true },
    messageId: { type: Number },
    publishable: { type: Boolean, default: false },
    riskFree: { type: Boolean, default: false },
    telegramBot: { type: String },
    createdOuncePrice: { type: Number, required: true, default: 0 },
    closedOuncePrice: { type: Number, required: false },
    activeAt: { type: Date, required: false },
    closedAt: { type: Date, required: false },
    deletedAt: { type: Date, required: false },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

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
SignalSchema.set('toJSON', { virtuals: true });
SignalSchema.set('toObject', { virtuals: true });