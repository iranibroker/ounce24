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
      const existSignalIndex = this.userSignals[owner.id].findIndex(x => x.id === signal.id);
      if (existSignalIndex > -1) this.userSignals[owner.id][existSignalIndex] = signal;
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
    return this.userSignals[userId];
  }
}
