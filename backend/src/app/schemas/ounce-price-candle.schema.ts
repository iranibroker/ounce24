import { OuncePriceCandle } from '@ounce24/types';
import mongoose from 'mongoose';

export const OuncePriceCandleSchema = new mongoose.Schema<OuncePriceCandle>(
  {
    timestamp: { type: Date, required: true, unique: true, index: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
  },
  {
    timestamps: false,
  },
);

OuncePriceCandleSchema.set('toJSON', { virtuals: true });
OuncePriceCandleSchema.set('toObject', { virtuals: true });
