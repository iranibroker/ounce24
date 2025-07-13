import { Podcast } from '@ounce24/types';
import mongoose from 'mongoose';

export const PodcastSchema = new mongoose.Schema<Podcast>(
  {
    title: { type: String, required: true },
    description: { type: String, required: false },
    url: { type: String, required: false },
    embedUrl: { type: String, required: false },
    publishedAt: { type: Date, required: false },
  },
  {
    timestamps: true,
  },
);