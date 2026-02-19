import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { OctopusPrediction, OctopusDirection, User } from '@ounce24/types';
import { OuncePriceService } from '../ounce-price/ounce-price.service';

/** Gold market close: 22:00 UTC (after NY session, COMEX daily break) */
const MARKET_CLOSE_HOUR_UTC = 22;

/** Iran timezone: UTC+3:30. Users can change prediction until 2 PM Iran time. */
const IRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;
const IRAN_CHANGE_CUTOFF_HOUR = 14;

@Injectable()
export class OctopusService {
  constructor(
    @InjectModel(OctopusPrediction.name)
    private predictionModel: Model<OctopusPrediction>,
    @InjectModel(User.name) private userModel: Model<User>,
    private ouncePriceService: OuncePriceService,
  ) {}

  private startOfDayUTC(date: Date): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /** True if user can change prediction: same calendar day in Iran, before 2 PM Iran time. */
  private canChangePrediction(voteDate: Date): boolean {
    const now = new Date();
    const iranNow = new Date(now.getTime() + IRAN_OFFSET_MS);
    const iranVoteDate = new Date(voteDate.getTime() + IRAN_OFFSET_MS);

    const iranNowY = iranNow.getUTCFullYear();
    const iranNowM = iranNow.getUTCMonth();
    const iranNowD = iranNow.getUTCDate();
    const iranVoteY = iranVoteDate.getUTCFullYear();
    const iranVoteM = iranVoteDate.getUTCMonth();
    const iranVoteD = iranVoteDate.getUTCDate();

    if (
      iranNowY !== iranVoteY ||
      iranNowM !== iranVoteM ||
      iranNowD !== iranVoteD
    ) {
      return false;
    }

    const iranHour = iranNow.getUTCHours();
    const iranMin = iranNow.getUTCMinutes();
    return iranHour < IRAN_CHANGE_CUTOFF_HOUR;
  }

  async vote(userId: string, direction: OctopusDirection) {
    const voteDate = this.startOfDayUTC(new Date());
    const existing = await this.predictionModel
      .findOne({ user: userId, voteDate })
      .exec();

    const price = this.ouncePriceService.current;
    if (!price || price <= 0) {
      throw new BadRequestException('Price not available');
    }

    if (existing) {
      if (!this.canChangePrediction(existing.voteDate)) {
        throw new BadRequestException(
          'Cannot change prediction after 2 PM Iran time',
        );
      }

      await this.predictionModel
        .updateOne(
          { _id: existing._id },
          { $set: { direction, votePrice: price } },
        )
        .exec();

      return {
        id: existing._id,
        direction,
        votePrice: price,
        voteDate,
        changed: true,
      };
    }

    const prediction = await this.predictionModel.create({
      user: userId,
      direction,
      votePrice: price,
      voteDate,
    });

    return {
      id: prediction._id,
      direction,
      votePrice: price,
      voteDate,
    };
  }

  async getSentiment(date?: Date) {
    const voteDate = date
      ? this.startOfDayUTC(date)
      : this.startOfDayUTC(new Date());

    const predictions = await this.predictionModel
      .find({ voteDate })
      .select('direction')
      .lean()
      .exec();

    const up = predictions.filter((p) => p.direction === 'up').length;
    const down = predictions.filter((p) => p.direction === 'down').length;
    const total = up + down;

    return {
      up,
      down,
      total,
      upPercent: total > 0 ? Math.round((up / total) * 100) : 0,
      downPercent: total > 0 ? Math.round((down / total) * 100) : 0,
    };
  }

  /** Settle predictions for the given date (uses close price from market close) */
  async settlePredictions(forDate: Date) {
    const voteDate = this.startOfDayUTC(forDate);
    const unsettled = await this.predictionModel
      .find({ voteDate, points: { $exists: false } })
      .exec();

    if (unsettled.length === 0) return { settled: 0 };

    const closePrice = this.ouncePriceService.current;
    if (!closePrice || closePrice <= 0) {
      console.warn('Octopus settle: No close price available, skipping');
      return { settled: 0 };
    }

    let settled = 0;
    for (const p of unsettled) {
      const correct =
        (p.direction === 'up' && closePrice > p.votePrice) ||
        (p.direction === 'down' && closePrice < p.votePrice);
      const points = correct ? 1 : 0;

      await this.predictionModel
        .updateOne(
          { _id: p._id },
          { $set: { closePrice, points } },
        )
        .exec();
      settled++;
    }

    return { settled };
  }

  /** Runs at 22:00 UTC Mon–Fri (gold market close). Settles the day that just ended. */
  @Cron(`0 ${MARKET_CLOSE_HOUR_UTC} * * 1-5`, { timeZone: 'UTC' })
  async settleDailyPredictions() {
    const today = new Date();
    return this.settlePredictions(today);
  }

  private getWeekRange(): { start: Date; end: Date } {
    const now = new Date();
    const daysSinceMonday = (now.getUTCDay() + 6) % 7;
    const start = new Date(now);
    start.setUTCDate(now.getUTCDate() - daysSinceMonday);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }

  private getMonthRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );
    return { start, end };
  }

  async getTopWeekly(limit = 10) {
    const { start, end } = this.getWeekRange();
    const agg = await this.predictionModel
      .aggregate([
        {
          $match: {
            voteDate: { $gte: start, $lte: end },
            points: { $exists: true },
          },
        },
        { $group: { _id: '$user', totalPoints: { $sum: '$points' } } },
        { $sort: { totalPoints: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userDoc',
          },
        },
        { $unwind: '$userDoc' },
        {
          $project: {
            userId: '$_id',
            totalPoints: 1,
            name: '$userDoc.name',
            title: '$userDoc.title',
            avatar: '$userDoc.avatar',
            rank: { $literal: 0 },
          },
        },
      ])
      .exec();

    return agg.map((r, i) => ({
      ...r,
      rank: i + 1,
    }));
  }

  async getTopMonthly(limit = 10) {
    const { start, end } = this.getMonthRange();
    const agg = await this.predictionModel
      .aggregate([
        {
          $match: {
            voteDate: { $gte: start, $lte: end },
            points: { $exists: true },
          },
        },
        { $group: { _id: '$user', totalPoints: { $sum: '$points' } } },
        { $sort: { totalPoints: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userDoc',
          },
        },
        { $unwind: '$userDoc' },
        {
          $project: {
            userId: '$_id',
            totalPoints: 1,
            name: '$userDoc.name',
            title: '$userDoc.title',
            avatar: '$userDoc.avatar',
            rank: { $literal: 0 },
          },
        },
      ])
      .exec();

    return agg.map((r, i) => ({
      ...r,
      rank: i + 1,
    }));
  }

  async getUserScores(userId: string) {
    const { start: weekStart, end: weekEnd } = this.getWeekRange();
    const { start: monthStart, end: monthEnd } = this.getMonthRange();
    const userObjId = new mongoose.Types.ObjectId(userId);

    const [week, month] = await Promise.all([
      this.predictionModel
        .aggregate([
          {
            $match: {
              user: userObjId,
              voteDate: { $gte: weekStart, $lte: weekEnd },
              points: { $exists: true },
            },
          },
          { $group: { _id: null, total: { $sum: '$points' } } },
        ])
        .exec(),
      this.predictionModel
        .aggregate([
          {
            $match: {
              user: userObjId,
              voteDate: { $gte: monthStart, $lte: monthEnd },
              points: { $exists: true },
            },
          },
          { $group: { _id: null, total: { $sum: '$points' } } },
        ])
        .exec(),
    ]);

    return {
      weekly: week[0]?.total ?? 0,
      monthly: month[0]?.total ?? 0,
    };
  }

  async getUserVote(userId: string, date?: Date) {
    const voteDate = date
      ? this.startOfDayUTC(date)
      : this.startOfDayUTC(new Date());

    const prediction = await this.predictionModel
      .findOne({ user: userId, voteDate })
      .lean()
      .exec();

    if (!prediction) {
      return { voted: false };
    }

    const settled = prediction.points != null;
    const canChange =
      !settled && this.canChangePrediction(prediction.voteDate);

    return {
      voted: true,
      direction: prediction.direction,
      votePrice: prediction.votePrice,
      voteDate: prediction.voteDate,
      closePrice: prediction.closePrice,
      points: prediction.points,
      settled,
      canChange,
    };
  }
}
