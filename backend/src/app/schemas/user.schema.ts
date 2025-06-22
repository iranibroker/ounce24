import { SignalStatus, User } from '@ounce24/types';
import mongoose from 'mongoose';

export const UserSchema = new mongoose.Schema<User>(
  {
    name: { type: String, required: true },
    title: { type: String, required: true },
    defaultScore: { type: Number, required: true, default: 0 },
    avatar: { type: String, required: false },
    telegramUsername: { type: String, required: false },
    telegramId: { type: Number, index: true, unique: true },
    avgRiskReward: { type: Number, required: true, default: 0 },
    score: { type: Number, required: true, default: 0 },
    totalScore: { type: Number, required: true, default: 0 },
    totalSignals: { type: Number, required: true, default: 0 },
    winRate: { type: Number, required: true, default: 0 },
    phone: { type: String, required: true, unique: true },
    resetAt: { type: Date, required: false },
    iban: { type: String, required: false },
    gem: { type: Number, required: true, default: 0 },
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
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });
