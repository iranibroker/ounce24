import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Achievement,
  AchievementType,
  Signal,
  SignalStatus,
  User,
  OctopusPrediction,
  Follow,
} from '@ounce24/types';
import mongoose, { Model } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS } from '../consts';
import { Cron } from '@nestjs/schedule';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    @InjectModel(Achievement.name) private achievementModel: Model<Achievement>,
    @InjectModel(OctopusPrediction.name) private predictionModel: Model<OctopusPrediction>,
    @InjectModel(Follow.name) private followModel: Model<Follow>,
    @InjectBot('main') private readonly bot: Telegraf<Context>,
  ) {}

  @OnEvent(EVENTS.SIGNAL_CLOSED)
  async handleSignalClosed(signal: Signal) {
    if (!signal.owner) return;

    await this.calculateUserStats(signal.owner);
    await this.checkIndividualAchievements(signal.owner.toString());
  }

  async calculateUserStats(user: User) {
    const now = new Date();
    
    // Calculate start of the current trading week (Sunday 17:00 America/New_York close)
    const nyParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    }).formatToParts(now);

    const partVal = (type: string) => parseInt(nyParts.find(p => p.type === type)!.value, 10);
    const nyYear = partVal('year');
    const nyMonth = partVal('month') - 1; // 0-indexed
    const nyDay = partVal('day');
    const nyHour = partVal('hour');

    const nyWeekdayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short'
    }).format(now);
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const nyDayOfWeek = weekdays.indexOf(nyWeekdayStr);

    let daysSinceSunday = nyDayOfWeek;
    if (nyDayOfWeek === 0 && nyHour < 17) {
      daysSinceSunday = 7;
    }

    const startOfTradingWeek = new Date(Date.UTC(nyYear, nyMonth, nyDay - daysSinceSunday, 22, 0, 0, 0));
    const targetNYHour = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false
    }).format(startOfTradingWeek), 10);
    startOfTradingWeek.setUTCHours(22 + (17 - targetNYHour));

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
        new Date(s.createdAt).valueOf() >= startOfTradingWeek.valueOf()
      ) {
        return acc + s.score;
      }
      return acc;
    }, 0);

    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthScore = userSignals.reduce((acc, s) => {
      if (
        s.closedAt &&
        new Date(s.createdAt).valueOf() >= startOfMonth.valueOf()
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
          monthScore,
        },
        {
          new: true,
        },
      )
      .exec();
  }

  async getLeaderboard(skip = 0, limit = 10, userId?: string, week = false, month = false) {
    let sort: any = { totalScore: -1 };
    if (week) {
      sort = { weekScore: -1 };
    } else if (month) {
      sort = { monthScore: -1 };
    }
    const publicFields = 'name title defaultScore avatar avatarSource avgRiskReward score totalScore totalSignals winRate weekScore monthScore createdAt';

    const users = await this.userModel
      .find()
      .select(publicFields)
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
      const user = await this.userModel
        .findById(userId)
        .select(publicFields)
        .exec();
      let condition: any = {
        totalScore: {
          $gt: user?.totalScore || 0,
        },
      };
      if (week) {
        condition = {
          weekScore: {
            $gt: user?.weekScore || 0,
          },
        };
      } else if (month) {
        condition = {
          monthScore: {
            $gt: user?.monthScore || 0,
          },
        };
      }
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
    // Dynamically backfill individual achievements and Octopus predictions streaks
    await this.checkIndividualAchievements(id);
    await this.checkOctopusStreakAchievements(id);

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

  async checkIndividualAchievements(userId: string) {
    const userSignals = await this.signalModel
      .find({
        owner: userId,
        status: SignalStatus.Closed,
        deletedAt: null,
      })
      .sort({ closedAt: 1 })
      .exec();

    if (userSignals.length === 0) return;

    const existingAchievements = await this.achievementModel
      .find({
        user: userId,
        type: {
          $in: [
            AchievementType.Hatrik20Points,
            AchievementType.FiftyPoint,
            AchievementType.FiveStreakR1,
            AchievementType.Winrate60In30,
          ],
        },
      })
      .exec();

    const existingCounts = {
      [AchievementType.Hatrik20Points]: existingAchievements.filter((a) => a.type === AchievementType.Hatrik20Points).length,
      [AchievementType.FiftyPoint]: existingAchievements.filter((a) => a.type === AchievementType.FiftyPoint).length,
      [AchievementType.FiveStreakR1]: existingAchievements.filter((a) => a.type === AchievementType.FiveStreakR1).length,
      [AchievementType.Winrate60In30]: existingAchievements.filter((a) => a.type === AchievementType.Winrate60In30).length,
    };

    // A. Fifty Points Signal: single signal with score >= 50
    const fiftyPointCount = userSignals.filter((s) => (s.score || 0) >= 50).length;

    // B. Hatrik 20 points signals: non-overlapping blocks of 3 consecutive signals where each score >= 20
    let hatrikCount = 0;
    let i = 0;
    while (i <= userSignals.length - 3) {
      if (
        (userSignals[i].score || 0) >= 20 &&
        (userSignals[i + 1].score || 0) >= 20 &&
        (userSignals[i + 2].score || 0) >= 20
      ) {
        hatrikCount++;
        i += 3;
      } else {
        i++;
      }
    }

    // C. 5 streak signal without lose (R/R upper 1): non-overlapping blocks of 5 consecutive signals where each pip >= 0 and riskReward >= 1
    let fiveStreakCount = 0;
    let j = 0;
    while (j <= userSignals.length - 5) {
      let validStreak = true;
      for (let k = 0; k < 5; k++) {
        const sig = userSignals[j + k];
        const isWin = (sig.pip || 0) >= 0;
        const rr = sig.riskReward || 0;
        if (!isWin || rr < 1) {
          validStreak = false;
          break;
        }
      }
      if (validStreak) {
        fiveStreakCount++;
        j += 5;
      } else {
        j++;
      }
    }

    // D. Winrate 60% in 30 signals (If R/R average upper 1): non-overlapping blocks of 30 signals where winrate >= 60% and average riskReward >= 1
    let winrate60Count = 0;
    let m = 0;
    while (m <= userSignals.length - 30) {
      let wins = 0;
      let totalRR = 0;
      for (let k = 0; k < 30; k++) {
        const sig = userSignals[m + k];
        if ((sig.pip || 0) >= 0) wins++;
        totalRR += sig.riskReward || 0;
      }
      const winrate = wins / 30;
      const avgRR = totalRR / 30;
      if (winrate >= 0.6 && avgRR >= 1) {
        winrate60Count++;
        m += 30;
      } else {
        m++;
      }
    }

    const toInsert: any[] = [];
    if (fiftyPointCount > existingCounts[AchievementType.FiftyPoint]) {
      const diff = fiftyPointCount - existingCounts[AchievementType.FiftyPoint];
      for (let x = 0; x < diff; x++) {
        toInsert.push({ type: AchievementType.FiftyPoint, user: userId });
      }
    }
    if (hatrikCount > existingCounts[AchievementType.Hatrik20Points]) {
      const diff = hatrikCount - existingCounts[AchievementType.Hatrik20Points];
      for (let x = 0; x < diff; x++) {
        toInsert.push({ type: AchievementType.Hatrik20Points, user: userId });
      }
    }
    if (fiveStreakCount > existingCounts[AchievementType.FiveStreakR1]) {
      const diff = fiveStreakCount - existingCounts[AchievementType.FiveStreakR1];
      for (let x = 0; x < diff; x++) {
        toInsert.push({ type: AchievementType.FiveStreakR1, user: userId });
      }
    }
    if (winrate60Count > existingCounts[AchievementType.Winrate60In30]) {
      const diff = winrate60Count - existingCounts[AchievementType.Winrate60In30];
      for (let x = 0; x < diff; x++) {
        toInsert.push({ type: AchievementType.Winrate60In30, user: userId });
      }
    }

    if (toInsert.length > 0) {
      await this.achievementModel.insertMany(toInsert);
    }
  }

  async checkOctopusStreakAchievements(userId: string) {
    const predictions = await this.predictionModel
      .find({
        user: userId,
        points: { $exists: true },
      })
      .sort({ voteDate: 1 })
      .exec();

    if (predictions.length === 0) return;

    const existingAchievements = await this.achievementModel
      .find({
        user: userId,
        type: {
          $in: [
            AchievementType.Octopus5Streak,
            AchievementType.Octopus10Streak,
          ],
        },
      })
      .exec();

    const existing5Counts = existingAchievements.filter((a) => a.type === AchievementType.Octopus5Streak).length;
    const existing10Counts = existingAchievements.filter((a) => a.type === AchievementType.Octopus10Streak).length;

    let fiveStreaks = 0;
    let tenStreaks = 0;

    let i = 0;
    while (i <= predictions.length - 5) {
      let isStreak = true;
      for (let k = 0; k < 5; k++) {
        if (predictions[i + k].points !== 1) {
          isStreak = false;
          break;
        }
      }
      if (isStreak) {
        fiveStreaks++;
        i += 5;
      } else {
        i++;
      }
    }

    let j = 0;
    while (j <= predictions.length - 10) {
      let isStreak = true;
      for (let k = 0; k < 10; k++) {
        if (predictions[j + k].points !== 1) {
          isStreak = false;
          break;
        }
      }
      if (isStreak) {
        tenStreaks++;
        j += 10;
      } else {
        j++;
      }
    }

    const toInsert: any[] = [];
    if (fiveStreaks > existing5Counts) {
      const diff = fiveStreaks - existing5Counts;
      for (let x = 0; x < diff; x++) {
        toInsert.push({ type: AchievementType.Octopus5Streak, user: userId });
      }
    }
    if (tenStreaks > existing10Counts) {
      const diff = tenStreaks - existing10Counts;
      for (let x = 0; x < diff; x++) {
        toInsert.push({ type: AchievementType.Octopus10Streak, user: userId });
      }
    }

    if (toInsert.length > 0) {
      await this.achievementModel.insertMany(toInsert);
    }
  }

  @Cron('15 17 * * *', {
    timeZone: 'America/New_York',
  })
  async dailyMarketCloseReset() {
    const users = await this.userModel.find().exec();
    for (const user of users) {
      await this.calculateUserStats(user);
    }
  }

  @Cron('30 17 * * 6', {
    timeZone: 'America/New_York',
  })
  async weekWinners() {
    // 1. Week winners signal (Leaderboard weekly winner)
    const leaderboard = await this.getLeaderboard(0, 10, undefined, true);
    const winner = leaderboard[0];
    if (winner) {
      await this.achievementModel.create({
        type: AchievementType.WeekWin,
        user: winner,
      });
    }

    // 2. Best signals in week (highest scoring signal closed in the week)
    const now = new Date();
    const nyParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    }).formatToParts(now);

    const partVal = (type: string) => parseInt(nyParts.find(p => p.type === type)!.value, 10);
    const nyYear = partVal('year');
    const nyMonth = partVal('month') - 1;
    const nyDay = partVal('day');

    const endOfPrevWeek = new Date(Date.UTC(nyYear, nyMonth, nyDay - 1, 22, 0, 0, 0));
    const targetNYHourEnd = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false
    }).format(endOfPrevWeek), 10);
    endOfPrevWeek.setUTCHours(22 + (17 - targetNYHourEnd));

    const startOfPrevWeek = new Date(endOfPrevWeek);
    startOfPrevWeek.setUTCDate(endOfPrevWeek.getUTCDate() - 5);

    const weeklySignals = await this.signalModel
      .find({
        status: SignalStatus.Closed,
        closedAt: { $gte: startOfPrevWeek, $lt: endOfPrevWeek },
        deletedAt: null,
        owner: { $ne: null },
      })
      .exec();

    let bestSignal = null;
    if (weeklySignals.length > 0) {
      weeklySignals.sort((a, b) => b.score - a.score);
      bestSignal = weeklySignals[0];
    }

    if (bestSignal && bestSignal.owner) {
      await this.achievementModel.create({
        type: AchievementType.BestSignalWeek,
        user: bestSignal.owner,
      });
    }

    // 3. Octopus weekly winners
    const topOctopusWeekly = await this.predictionModel.aggregate([
      {
        $match: {
          voteDate: { $gte: startOfPrevWeek, $lt: endOfPrevWeek },
          points: { $exists: true },
        },
      },
      { $group: { _id: '$user', totalPoints: { $sum: '$points' } } },
      { $sort: { totalPoints: -1 } },
      { $limit: 1 },
    ]).exec();

    if (topOctopusWeekly.length > 0) {
      const winnerId = topOctopusWeekly[0]._id;
      await this.achievementModel.create({
        type: AchievementType.OctopusWeekWin,
        user: winnerId,
      });
    }
  }

  @Cron('45 17 1 * *', {
    timeZone: 'America/New_York',
  })
  async monthWinners() {
    const now = new Date();
    // 1st day of the Gregorian month at 17:45 NY time. Prev month range:
    const startOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
    const endOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));

    const monthlySignals = await this.signalModel
      .find({
        status: SignalStatus.Closed,
        closedAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
        deletedAt: null,
        owner: { $ne: null },
      })
      .exec();

    // A. Month winners signal (highest score accumulated from signals closed during the Gregorian month)
    const userScoresMap: { [key: string]: number } = {};
    for (const sig of monthlySignals) {
      const ownerId = sig.owner.toString();
      userScoresMap[ownerId] = (userScoresMap[ownerId] || 0) + sig.score;
    }

    let winnerId = null;
    let maxScore = -Infinity;
    for (const [userId, score] of Object.entries(userScoresMap)) {
      if (score > maxScore) {
        maxScore = score;
        winnerId = userId;
      }
    }

    if (winnerId) {
      await this.achievementModel.create({
        type: AchievementType.MonthWin,
        user: winnerId,
      });
    }

    // B. Best signals in month (highest scoring signal closed in the Gregorian month)
    let bestSignalMonth = null;
    if (monthlySignals.length > 0) {
      monthlySignals.sort((a, b) => b.score - a.score);
      bestSignalMonth = monthlySignals[0];
    }

    if (bestSignalMonth && bestSignalMonth.owner) {
      await this.achievementModel.create({
        type: AchievementType.BestSignalMonth,
        user: bestSignalMonth.owner,
      });
    }

    // C. Octopus monthly winners
    const topOctopusMonthly = await this.predictionModel.aggregate([
      {
        $match: {
          voteDate: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
          points: { $exists: true },
        },
      },
      { $group: { _id: '$user', totalPoints: { $sum: '$points' } } },
      { $sort: { totalPoints: -1 } },
      { $limit: 1 },
    ]).exec();

    if (topOctopusMonthly.length > 0) {
      const winnerId = topOctopusMonthly[0]._id;
      await this.achievementModel.create({
        type: AchievementType.OctopusMonthWin,
        user: winnerId,
      });
    }
  }

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }
    const targetUser = await this.userModel.findById(followingId).exec();
    if (!targetUser) {
      throw new NotFoundException({
        translationKey: 'userNotFound',
      });
    }

    try {
      await this.followModel.create({
        follower: followerId,
        following: followingId,
      });
    } catch (err: any) {
      if (err.code !== 11000) {
        throw err;
      }
      return { success: true };
    }

    // Trigger notification asynchronously
    this.sendFollowTelegramNotification(followerId, targetUser).catch((err) => {
      console.error('Failed to send Telegram follow notification:', err);
    });

    return { success: true };
  }

  private async sendFollowTelegramNotification(followerId: string, targetUser: any) {
    if (!targetUser || !targetUser.telegramId) {
      return;
    }

    try {
      const follower = await this.userModel.findById(followerId).exec();
      if (!follower) return;

      const followersCount = await this.followModel.countDocuments({ following: targetUser._id }).exec();
      const followerName = follower.title || follower.name || 'یک کاربر';

      const message = `👤 <b>${followerName}</b> شما را فالو کرد!\n\n` +
        `📊 تعداد کل دنبال‌کنندگان شما: <b>${followersCount}</b> نفر\n\n` +
        `✨ امکانات بیشتر و کارکردن راحت‌تر با اپلیکیشن`;

      const appUrl = process.env.APP_URL || 'https://app.ounce24.com';
      const inlineKeyboard = [
        [
          {
            text: 'ورود به اپلیکیشن 📱',
            url: appUrl,
          },
        ],
      ];

      await this.bot.telegram.sendMessage(targetUser.telegramId, message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      });
    } catch (err) {
      console.error('Error in sendFollowTelegramNotification:', err);
    }
  }

  async unfollowUser(followerId: string, followingId: string) {
    await this.followModel.deleteOne({
      follower: followerId,
      following: followingId,
    }).exec();
    return { success: true };
  }

  async getUserFollowing(userId: string, page: number, limit: number) {
    const skip = page * limit;
    const follows = await this.followModel
      .find({ follower: userId })
      .skip(skip)
      .limit(limit)
      .populate('following')
      .exec();

    return follows.map((f: any) => {
      const userObj = f.following?.toJSON ? f.following.toJSON() : f.following;
      if (!userObj) return null;
      return userObj;
    }).filter(Boolean);
  }

  async getUserFollowers(userId: string, page: number, limit: number) {
    const skip = page * limit;
    const follows = await this.followModel
      .find({ following: userId })
      .skip(skip)
      .limit(limit)
      .populate('follower')
      .exec();

    return follows.map((f: any) => {
      const userObj = f.follower?.toJSON ? f.follower.toJSON() : f.follower;
      if (!userObj) return null;
      return userObj;
    }).filter(Boolean);
  }
}
