import { User } from '@ounce24/types';
import mongoose from 'mongoose';

export const UserSchema = new mongoose.Schema<User>(
  {
    name: { type: String, required: false },
    title: { type: String, required: false },
    defaultScore: { type: Number, required: true, default: 0 },
    avatar: { type: String, required: false },
    telegramUsername: { type: String, required: false },
    telegramId: { type: Number, index: { unique: false } },
    avgRiskReward: { type: Number, required: true, default: 0 },
    score: { type: Number, required: true, default: 0 },
    totalScore: { type: Number, required: true, default: 0 },
    totalSignals: { type: Number, required: true, default: 0 },
    winRate: { type: Number, required: true, default: 0 },
    phone: { type: String, required: true, unique: true },
    alwaysPublish: { type: Boolean, required: false, default: false },
    resetAt: { type: Date, required: false },
    iban: { type: String, required: false },
    gem: { type: Number, required: true, default: 0 },
    alternativeTelegramToken: { type: String, required: false },
    weekScore: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
  },
);

UserSchema.virtual('tag').get(function () {
  let tag = '#';
  const cleanedTitle = (this.title || this.name)
    ?.replace(/[&@#.]/g, '')
    ?.replace(/[ -]/g, '_');
  tag += cleanedTitle;
  return tag;
});
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });
