import { SignalStatus, User } from '@ounce24/types';
import mongoose from 'mongoose';

export const UserSchema = new mongoose.Schema<User>(
  {
    name: { type: String, required: true },
    title: { type: String, required: true },
    defaultScore: { type: Number, required: true, default: 0 },
    telegramUsername: { type: String, required: false },
    telegramId: { type: Number, index: true, unique: true },
    avgRiskReward: { type: Number, required: true, default: 0 },
    totalScore: { type: Number, required: true, default: 0 },
    totalSignals: { type: Number, required: true, default: 0 },
    winRate: { type: Number, required: true, default: 0 },
    phone: { type: String, required: true, unique: true },
    resetAt: { type: Date, required: false },
    iban: { type: String, required: false },
  },
  {
    timestamps: true,
  },
);

UserSchema.virtual('tag').get(function () {
  let tag = '#استاد_';
  const cleanedTitle = (this.title || this.name)
    .replace(/[&@#.]/g, '')
    .replace(/[ -]/g, '_');
  tag += cleanedTitle;
  return tag;
});

UserSchema.virtual('score').get(function () {
  if (this.totalScore === 0 || this.totalSignals === 0) return 0;
  const avgScore = this.totalScore / this.totalSignals;
  return avgScore * Math.log(this.totalSignals + 1);
});
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });
