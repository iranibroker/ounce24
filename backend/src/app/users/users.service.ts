import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Achievement,
  AchievementType,
  Signal,
  SignalStatus,
  User,
} from '@ounce24/types';
import { Model } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS } from '../consts';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    @InjectModel(Achievement.name) private achievementModel: Model<Achievement>,
  ) {}

  @OnEvent(EVENTS.SIGNAL_CLOSED)
  async handleSignalClosed(signal: Signal) {
    if (!signal.owner) return;

    this.calculateUserStats(signal.owner);
  }

  async calculateUserStats(user: User) {
    const now = new Date();
    const daysSinceMonday = (now.getUTCDay() + 6) % 7; // Days since last Monday (Monday = 1, Sunday = 0)
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() - daysSinceMonday);
    lastMonday.setUTCHours(0, 0, 0, 0);

    const userSignals = await this.signalModel.find({
      owner: user,
      status: { $in: [SignalStatus.Closed] },
      deletedAt: null,
    });

    if (userSignals.length === 0) {
      return;
    }

    const totalSignals = userSignals.length;
    const winSignals = userSignals.filter((s) => s.pip > 0).length;
    const winRate = totalSignals > 0 ? (winSignals / totalSignals) * 100 : 0;
    const avgRiskReward =
      userSignals.reduce((acc, s) => acc + (s.riskReward || 0), 0) /
        totalSignals || 0;
    const totalScore = userSignals.reduce((acc, s) => acc + s.score, 0);

    const weekScore = userSignals.reduce((acc, s) => {
      if (
        s.closedAt &&
        new Date(s.createdAt).valueOf() >= lastMonday.valueOf()
      ) {
        return acc + s.score;
      }
      return acc;
    }, 0);

    return this.userModel
      .findByIdAndUpdate(
        user,
        {
          totalSignals,
          winRate,
          avgRiskReward,
          totalScore,
          score: totalScore,
          weekScore,
        },
        {
          new: true,
        },
      )
      .exec();
  }

  async getLeaderboard(skip = 0, limit = 10, userId?: string, week = false) {
    const sort: any = week ? { weekScore: -1 } : { totalScore: -1 };

    const users = await this.userModel
      .find()
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .exec();

    // Add rank to each user
    const usersWithRank = users.map((user, index) => ({
      ...user.toObject(),
      rank: skip + index + 1,
    }));

    // If userId is provided, find that user's position
    if (userId && !users.some((user) => user.id === userId)) {
      const user = await this.userModel.findById(userId).exec();
      const condition = week
        ? {
            weekScore: {
              $gt: user?.weekScore || 0,
            },
          }
        : {
            totalScore: {
              $gt: user?.totalScore || 0,
            },
          };
      const userPosition = await this.userModel
        .countDocuments({
          ...condition,
        })
        .exec();

      if (user) {
        usersWithRank.push({
          ...user.toObject(),
          rank: userPosition + 1,
        });
      }
    }

    return usersWithRank;
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException({
        translationKey: 'userNotFound',
      });
    }
    return user;
  }

  async getUserSignals(id: string, page: number, limit: number) {
    const skip = page * limit;
    return this.signalModel
      .find({
        owner: id,
        deletedAt: null,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async getUserAchievements(id: string, page: number, limit: number) {
    const skip = page * limit;
    return this.achievementModel
      .find({
        user: id,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  @Cron('0 15 0 * * 1', {
    timeZone: 'UTC',
  })
  async resetWeekScore() {
    const users = await this.userModel.find().exec();
    for (const user of users) {
      await this.calculateUserStats(user);
    }
  }

  @Cron('0 30 0 * * 6', {
    timeZone: 'UTC',
  })
  async weekWinners() {
    const leaderboard = await this.getLeaderboard(0, 10, undefined, true);
    const winner = leaderboard[0];
    if (winner) {
      await this.achievementModel.create({
        type: AchievementType.WeekWin,
        user: winner,
      });
    }
  }
}
