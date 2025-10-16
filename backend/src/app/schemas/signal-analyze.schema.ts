import { SignalAnalyze } from '@ounce24/types';
import mongoose from 'mongoose';

export const SignalAnalyzeSchema = new mongoose.Schema<SignalAnalyze>(
  {
    signal: { type: mongoose.Schema.Types.ObjectId, ref: 'Signal', required: true },
    ouncePrice: { type: Number, required: true },
    analyzeText: { type: String, required: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalTokens: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
  },
);

SignalAnalyzeSchema.set('toJSON', { virtuals: true });
SignalAnalyzeSchema.set('toObject', { virtuals: true });

