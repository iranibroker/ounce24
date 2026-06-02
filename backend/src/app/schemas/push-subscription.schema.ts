import mongoose from 'mongoose';

export class PushSubscription {
  _id: any;
  id: string;
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export const PushSubscriptionSchema = new mongoose.Schema<PushSubscription>(
  {
    endpoint: { type: String, required: true, unique: true },
    expirationTime: { type: Number, required: false, default: null },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userId: { type: String, required: false, default: null },
  },
  {
    timestamps: true,
  }
);
