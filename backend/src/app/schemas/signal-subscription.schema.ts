import { SignalSubscription } from '@ounce24/types';
import mongoose from 'mongoose';

export const SignalSubscriptionSchema = new mongoose.Schema<SignalSubscription>(
  {
    signal: { type: mongoose.Schema.Types.ObjectId, ref: 'Signal', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    followStatus: { type: Boolean, default: false },
    aiShield: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

SignalSubscriptionSchema.index({ signal: 1, user: 1 }, { unique: true });
