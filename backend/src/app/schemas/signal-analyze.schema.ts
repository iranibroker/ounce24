import { SignalAnalyze, TradingStyle, RiskTolerance } from '@ounce24/types';
import mongoose from 'mongoose';

export const SignalAnalyzeSchema = new mongoose.Schema<SignalAnalyze>(
  {
    signal: { type: mongoose.Schema.Types.ObjectId, ref: 'Signal', required: false },
    ouncePrice: { type: Number, required: true },
    analyzeText: { type: String, required: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalTokens: { type: Number, required: true, default: 0 },
    prompt: { type: String, required: false },
    model: { type: String, required: false },
    tradingStyle: {
      type: String,
      enum: Object.values(TradingStyle),
      required: false,
    },
    riskTolerance: {
      type: String,
      enum: Object.values(RiskTolerance),
      required: false,
    },
    language: { type: String, required: false },
  },
  {
    timestamps: true,
  },
);

SignalAnalyzeSchema.set('toJSON', { virtuals: true });
SignalAnalyzeSchema.set('toObject', { virtuals: true });

