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
    gemsUsed: { type: Number, required: true, min: 0 },
    gemsBefore: { type: Number, required: true, min: 0 },
    gemsAfter: { type: Number, required: true, min: 0 },
    action: { type: String, required: true, enum: GemLogAction },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

GemLogSchema.set('toJSON', { virtuals: true });
GemLogSchema.set('toObject', { virtuals: true });
