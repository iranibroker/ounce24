import { GemLog, GemLogAction } from '@ounce24/types';
import mongoose from 'mongoose';

export const GemLogSchema = new mongoose.Schema<GemLog>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    gemsChange: { type: Number, required: true },
    gemsBefore: { type: Number, required: true },
    gemsAfter: { type: Number, required: true },
    action: { type: String, required: true, enum: GemLogAction },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

GemLogSchema.set('toJSON', { virtuals: true });
GemLogSchema.set('toObject', { virtuals: true });
