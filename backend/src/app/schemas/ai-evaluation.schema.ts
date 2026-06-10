import { AiEvaluation, AiEvaluationType, AiEvaluationOutcome } from '@ounce24/types';
import mongoose from 'mongoose';

export const AiEvaluationSchema = new mongoose.Schema<AiEvaluation>(
  {
    signal: { type: mongoose.Schema.Types.ObjectId, ref: 'Signal', required: false },
    type: { type: String, enum: Object.values(AiEvaluationType), required: true },
    prompt: { type: String, required: true },
    response: { type: mongoose.Schema.Types.Mixed, required: true },
    model: { type: String, required: true },
    promptTokens: { type: Number, required: true, default: 0 },
    completionTokens: { type: Number, required: true, default: 0 },
    totalTokens: { type: Number, required: true, default: 0 },
    latencyMs: { type: Number, required: true, default: 0 },
    predictedProbability: { type: Number, required: false },
    actualOutcome: {
      type: String,
      enum: Object.values(AiEvaluationOutcome),
      required: true,
      default: AiEvaluationOutcome.None,
    },
    actualPip: { type: Number, required: false },
    calibrationError: { type: Number, required: false },
    feedback: { type: String, required: false },
  },
  {
    timestamps: true,
  },
);

AiEvaluationSchema.set('toJSON', { virtuals: true });
AiEvaluationSchema.set('toObject', { virtuals: true });
