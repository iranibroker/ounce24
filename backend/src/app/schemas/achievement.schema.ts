import { Achievement, AchievementType } from '@ounce24/types';
import mongoose from 'mongoose';

export const AchievementSchema = new mongoose.Schema<Achievement>(
  {
    type: { type: String, enum: AchievementType, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);
