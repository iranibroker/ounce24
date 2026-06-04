import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { OctopusPrediction, OctopusDirection, User } from '@ounce24/types';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { EVENTS } from '../consts';

/** Gold market close: 22:00 UTC (after NY session, COMEX daily break) */
const MARKET_CLOSE_HOUR_UTC = 22;

/** Iran timezone: UTC+3:30. Users can change prediction until a specific cutoff hour Iran time. */
const IRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

function getCutoffHour(): number {
  const envVal = process.env.OCTOPUS_CUTOFF_HOUR;
  if (envVal) {
    const parsed = parseFloat(envVal);
    if (!isNaN(parsed)) return parsed;
  }
  return 10.5; // default 10:30 AM UTC (which is 14:00 Tehran Time)
}

function isVotingEnabled(now: Date, cutoffHour: number): boolean {
  const day = now.getUTCDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
  const timeInHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;

  if (day === 6) { // Saturday
    return false;
  }
  if (day === 0) { // Sunday
    return timeInHours >= 23;
  }
  if (day === 5) { // Friday
    return timeInHours < cutoffHour;
  }
  // Monday, Tuesday, Wednesday, Thursday
  return timeInHours < cutoffHour || timeInHours >= 23;
}

@Injectable()
export class OctopusService {
  constructor(
    @InjectModel(OctopusPrediction.name)
    private predictionModel: Model<OctopusPrediction>,
    @InjectModel(User.name) private userModel: Model<User>,
    private ouncePriceService: OuncePriceService,
  ) {}

  getCutoffHourVal(): number {
    return getCutoffHour();
  }

  private getTehranCalendarDate(date: Date): Date {
    const tehranTime = new Date(date.getTime() + IRAN_OFFSET_MS);
    const y = tehranTime.getUTCFullYear();
    const m = tehranTime.getUTCMonth();
    const d = tehranTime.getUTCDate();
    return new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  }

  /** True if user can change prediction: same calendar day in Iran, before cutoff hour UTC. */
  private canChangePrediction(voteDate: Date): boolean {
    const now = new Date();
    const currentTehranDate = this.getTehranCalendarDate(now);

    if (voteDate.getTime() !== currentTehranDate.getTime()) {
      return false;
    }

    return isVotingEnabled(now, getCutoffHour());
  }

  async vote(userId: string, direction: OctopusDirection) {
    const now = new Date();
    const voteDate = this.getTehranCalendarDate(now);

    const isMarketOpen = this.ouncePriceService.isMarketOpen(now);
    if (!isMarketOpen) {
      throw new BadRequestException('Market is closed');
    }

    if (!this.canChangePrediction(voteDate)) {
      const cutoff = getCutoffHour();
      const hrs = Math.floor(cutoff);
      const mins = Math.round((cutoff - hrs) * 60);
      const timeStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      throw new BadRequestException(
        `Cannot place or change prediction after ${timeStr} UTC`,
      );
    }

    const existing = await this.predictionModel
      .findOne({ user: userId, voteDate })
      .exec();

    const price = this.ouncePriceService.current;
    if (!price || price <= 0) {
      throw new BadRequestException('Price not available');
    }

    if (existing) {
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
      ? this.getTehranCalendarDate(date)
      : this.getTehranCalendarDate(new Date());

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
    const voteDate = this.getTehranCalendarDate(forDate);
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

  /** Settles predictions for the day when the MARKET_CLOSED event is received. */
  @OnEvent(EVENTS.MARKET_CLOSED)
  async settleDailyPredictions() {
    const today = new Date();
    // Adjust by subtracting 4 hours to get the correct trading day's calendar date in Tehran
    const settleDate = new Date(today.getTime() - 4 * 60 * 60 * 1000);
    return this.settlePredictions(settleDate);
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

  async getTopTotal(limit = 10) {
    const agg = await this.predictionModel
      .aggregate([
        {
          $match: {
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

    const [week, month, total] = await Promise.all([
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
      this.predictionModel
        .aggregate([
          {
            $match: {
              user: userObjId,
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
      total: total[0]?.total ?? 0,
    };
  }

  async getUserVote(userId: string, date?: Date) {
    const voteDate = date
      ? this.getTehranCalendarDate(date)
      : this.getTehranCalendarDate(new Date());

    const prediction = await this.predictionModel
      .findOne({ user: userId, voteDate })
      .lean()
      .exec();

    const isMarketOpen = this.ouncePriceService.isMarketOpen();

    if (!prediction) {
      return {
        voted: false,
        canVote: isMarketOpen && this.canChangePrediction(voteDate),
      };
    }

    const settled = prediction.points != null;
    const canChange =
      !settled && isMarketOpen && this.canChangePrediction(prediction.voteDate);

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
