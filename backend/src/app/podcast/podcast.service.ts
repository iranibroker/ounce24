import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Podcast } from '@ounce24/types';
import { Model } from 'mongoose';

@Injectable()
export class PodcastService {
  constructor(
    @InjectModel(Podcast.name) private podcastModel: Model<Podcast>,
  ) {}

  async getPodcasts(skip = 0, limit = 20): Promise<Podcast[]> {
    return this.podcastModel
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async getPodcastById(id: string): Promise<Podcast | null> {
    return this.podcastModel.findById(id).exec();
  }

  async createPodcast(podcast: Partial<Podcast>): Promise<Podcast> {
    const newPodcast = new this.podcastModel(podcast);
    return newPodcast.save();
  }

  async updatePodcast(id: string, podcast: Partial<Podcast>): Promise<Podcast | null> {
    return this.podcastModel.findByIdAndUpdate(id, podcast, { new: true }).exec();
  }

  async deletePodcast(id: string): Promise<Podcast | null> {
    return this.podcastModel.findByIdAndDelete(id).exec();
  }
} 