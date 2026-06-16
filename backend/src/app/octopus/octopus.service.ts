import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { OctopusPrediction, OctopusDirection, User } from '@ounce24/types';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { EVENTS } from '../consts';

/** Gold market close: 22:00 UTC (after NY session, COMEX daily break) */
const MARKET_CLOSE_HOUR_UTC = 22;

function getCutoffHour(): number {
  const envVal = process.env.OCTOPUS_CUTOFF_HOUR;
  if (envVal) {
    const parsed = parseFloat(envVal);
    if (!isNaN(parsed)) return parsed;
  }
  return 10.5; // default 10:30 AM UTC (which is 14:00 Tehran Time)
}

function getNYHour(date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: 'numeric',
  });
  return parseInt(formatter.formatToParts(date).find((p) => p.type === 'hour')!.value, 10);
}

function isVotingEnabled(now: Date, cutoffHour: number, isMarketOpen: boolean): boolean {
  if (!isMarketOpen) {
    return false;
  }
  const nyHour = getNYHour(now);
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;

  return utcHours < cutoffHour || nyHour >= 18;
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

  private getTradingDayDate(date: Date): Date {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const partVal = (type: string) => parseInt(parts.find((p) => p.type === type)!.value, 10);

    const year = partVal('year');
    const month = partVal('month') - 1;
    const day = partVal('day');
    const hour = partVal('hour');

    const nyDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    if (hour >= 18) {
      nyDate.setUTCDate(nyDate.getUTCDate() + 1);
    }
    return nyDate;
  }

  /** True if user can change prediction: same trading day, before cutoff hour UTC. */
  private canChangePrediction(voteDate: Date): boolean {
    const now = new Date();
    const currentTradingDate = this.getTradingDayDate(now);

    if (voteDate.getTime() !== currentTradingDate.getTime()) {
      return false;
    }

    const isMarketOpen = this.ouncePriceService.isMarketOpen(now);
    return isVotingEnabled(now, getCutoffHour(), isMarketOpen);
  }

  async vote(userId: string, direction: OctopusDirection) {
    const now = new Date();
    const voteDate = this.getTradingDayDate(now);

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
      ? this.getTradingDayDate(date)
      : this.getTradingDayDate(new Date());

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
    const voteDate = this.getTradingDayDate(forDate);
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
      ? this.getTradingDayDate(date)
      : this.getTradingDayDate(new Date());

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

  async getUserHistory(userId: string, page = 0, limit = 20) {
    const skip = page * limit;
    return this.predictionModel
      .find({ user: userId })
      .sort({ voteDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }
}
