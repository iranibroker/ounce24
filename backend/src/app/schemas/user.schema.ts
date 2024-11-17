import { User } from '@ounce24/types';
import mongoose from 'mongoose';

export const UserSchema = new mongoose.Schema<User>(
  {
    name: { type: String, required: true },
    title: { type: String, required: true },
    defaultScore: { type: Number, required: true, default: 0 },
    telegramUsername: { type: String, required: false },
    telegramId: { type: Number, index: true, unique: true },
    phone: { type: String, required: true, unique: true },
    resetAt: { type: Date, required: false },
    iban: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

UserSchema.virtual('tag').get(function () {
  let tag = '#استاد_';
  if (this.title) {
    const cleanedTitle = this.title
      .replace(/[&@#.]/g, '')
      .replace(/[ -]/g, '_');
    tag += cleanedTitle;
  }
  return tag;
});
