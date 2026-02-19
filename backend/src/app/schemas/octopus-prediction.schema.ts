import mongoose from 'mongoose';

export const OctopusPredictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    direction: { type: String, enum: ['up', 'down'], required: true },
    votePrice: { type: Number, required: true },
    voteDate: { type: Date, required: true },
    closePrice: { type: Number, required: false },
    points: { type: Number, required: false },
  },
  { timestamps: true },
);

OctopusPredictionSchema.index({ user: 1, voteDate: 1 }, { unique: true });
OctopusPredictionSchema.index({ voteDate: 1 });
OctopusPredictionSchema.index({ user: 1 });
