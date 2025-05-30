import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Signal, SignalStatus, User } from '@ounce24/types';
import { Model } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS } from '../consts';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
  ) {}

  @OnEvent(EVENTS.SIGNAL_CLOSED)
  async handleSignalClosed(signal: Signal) {
    if (!signal.owner) return;

    this.calculateUserStats(signal.owner);
  }

  async calculateUserStats(user: User) {
    const userSignals = await this.signalModel.find({
      owner: user,
      status: { $in: [SignalStatus.Closed] },
      deletedAt: null,
    });

    const totalSignals = userSignals.length;
    const winSignals = userSignals.filter((s) => s.pip > 0).length;
    const winRate = totalSignals > 0 ? (winSignals / totalSignals) * 100 : 0;
    const avgRiskReward =
      userSignals.reduce((acc, s) => acc + (s.riskReward || 0), 0) /
        totalSignals || 0;
    const totalScore = userSignals.reduce((acc, s) => acc + s.score, 0);
    this.userModel
      .findByIdAndUpdate(user, {
        totalSignals,
        winRate,
        avgRiskReward,
        totalScore,
      })
      .exec();
  }

  async getLeaderboard(skip = 0, limit = 10) {
    return this.userModel
      .find()
      .sort({ score: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }
}
