import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Signal, SignalStatus, User } from '@ounce24/types';
import { Model } from 'mongoose';

@Injectable()
export class UserStatsService {
  private userSignals: {
    [key: string]: Signal[];
  } = {};

  constructor(
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    @InjectModel(User.name) private userModel: Model<User>
  ) {
    this.userModel
      .find()
      .exec()
      .then((users) => {
        for (const user of users) {
          this.updateUserSignals(user);
        }
      });
  }

  async updateUserSignals(owner: User, signal?: Signal) {
    if (signal) {
      const existSignalIndex = this.userSignals[owner.id].findIndex(
        (x) => x.id === signal.id
      );
      if (existSignalIndex > -1)
        this.userSignals[owner.id][existSignalIndex] = signal;
      else this.userSignals[owner.id].push(signal);
    } else {
      const signals = await this.signalModel.find({
        owner: owner._id,
        status: { $in: [SignalStatus.Canceled, SignalStatus.Closed] },
        deletedAt: null,
      });
      this.userSignals[owner.id] = signals;
    }
  }

  getUserSignals(userId: string) {
    return this.userSignals[userId] || [];
  }

  getUserScore(userId: string, fromDate?: Date) {
    let signals = this.getUserSignals(userId);
    if (fromDate)
      signals = signals.filter(
        (signal) => signal.closedAt.valueOf() >= fromDate.valueOf()
      );
    if (signals) {
      return signals.reduce((value, signal) => {
        return signal.score + value;
      }, 0);
    }
    return 0;
  }

  async getLeaderBoard(fromDate?: Date) {
    const users = await this.userModel.find().exec();
    for (const user of users) {
      user.score = this.getUserScore(user.id, fromDate);
    }

    users.sort((a, b) => b.score - a.score);
    return users;
  }

  async getLeaderBoardMessage(options?: {
    userId?: string;
    length?: number;
    fromDate?: Date;
  }) {
    const users = await this.getLeaderBoard(options?.fromDate);

    const top10 = users.slice(0, options?.length || 9);

    let texts = `⭐ رنکینگ ${
      options?.fromDate ? 'هفتگی' : 'کلی'
    } اساتید ⭐\n\n`;
    texts += top10
      .map((user, index) => {
        return `${index + 1}. ${user.title} (${user.score.toFixed(1)} امتیاز)`;
      })
      .join('\n');

    if (options?.userId && !top10.find((user) => user.id === options.userId)) {
      const userIndex = users.findIndex((user) => user.id === options.userId);
      const user = users.find((user) => user.id === options.userId);
      texts += `\n--------\n${userIndex + top10.length}. ${
        user.title
      } (${user.score.toFixed(1)} امتیاز)`;
    }

    return texts;
  }
}
