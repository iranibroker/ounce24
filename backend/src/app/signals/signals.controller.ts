import { Body, Controller, Get, Param, Post, Query, Delete, ForbiddenException, BadRequestException, NotFoundException, Req } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  GemLog,
  Signal,
  SignalSource,
  SignalStatus,
  User,
  TradingStyle,
  RiskTolerance,
  Follow,
  SignalSubscription,
} from '@ounce24/types';
import { Model } from 'mongoose';
import { Public } from '../auth/public.decorator';
import { LoginUser } from '../auth/user.decorator';
import { SignalsService } from './signals.service';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { AuthService } from '../auth/auth.service';

@Controller('signals')
export class SignalsController {
  private readonly publicUserFields =
    'name title avatar avatarSource avgRiskReward score totalScore totalSignals winRate weekScore rank createdAt';

  constructor(
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Follow.name) private followModel: Model<Follow>,
    @InjectModel(SignalSubscription.name) private signalSubModel: Model<SignalSubscription>,
    private readonly signalService: SignalsService,
    private readonly ouncePriceService: OuncePriceService,
    private readonly auth: AuthService,
  ) {}

  private async populateOwnersRank(signals: any[]): Promise<void> {
    const uniqueOwners = new Map<string, any>();
    for (const signal of signals) {
      if (signal && signal.owner && typeof signal.owner === 'object') {
        const ownerId = (signal.owner._id || signal.owner.id)?.toString();
        if (ownerId && !uniqueOwners.has(ownerId)) {
          uniqueOwners.set(ownerId, signal.owner);
        }
      }
    }

    if (uniqueOwners.size === 0) return;

    await Promise.all(
      Array.from(uniqueOwners.entries()).map(async ([ownerId, owner]) => {
        const totalScore = owner.totalScore ?? 0;
        const rank = await this.userModel.countDocuments({ totalScore: { $gt: totalScore } }).exec();
        owner.rank = rank + 1;
      })
    );
  }

  private sanitizeSignal(signal: any): any {
    if (!signal) return signal;
    const signalObj = typeof signal.toObject === 'function' ? signal.toObject() : signal;
    if (signalObj.owner && typeof signalObj.owner === 'object') {
      const publicFields = [
        'id',
        '_id',
        'name',
        'title',
        'tag',
        'avatar',
        'avatarSource',
        'avgRiskReward',
        'score',
        'totalScore',
        'totalSignals',
        'winRate',
        'weekScore',
        'rank',
        'createdAt',
      ];
      const sanitizedOwner: any = {};
      for (const field of publicFields) {
        if (signalObj.owner[field] !== undefined) {
          sanitizedOwner[field] = signalObj.owner[field];
        }
      }
      signalObj.owner = sanitizedOwner;
    }
    return signalObj;
  }

  private sanitizeSignals(signals: any[]): any[] {
    return (signals || []).map((s) => this.sanitizeSignal(s));
  }

  @Public()
  @Get('today')
  async todaySignals() {
    const date = new Date();
    date.setHours(0,0,0,0);
    const signals = await this.signalModel
      .find({
        closedAt: { $gte: date },
        status: SignalStatus.Closed,
        deletedAt: null
      })
      .populate('owner', this.publicUserFields)
      .sort({
        updatedAt: -1
      }).exec();
    await this.populateOwnersRank(signals);
    return this.sanitizeSignals(signals);
  }
  

  @Public()
  @Get('problem')
  getProblemSignals() {
    return this.signalModel
      .find({
        $or: [
          {
            $expr: {
              $gt: ['$minPrice', '$maxPrice']
            }
          },
          {
            closedAtPrice: { $lt: 2900 }
          }
        ],
        deletedAt: null
      })
      .sort({
        createdAt: -1
      }).exec();
  }

  @Public()
  @Get('market/state')
  async getMarketState() {
    return this.signalService.getMarketState();
  }

  @Public()
  @Get(':id')
  async getSignal(@Param('id') id: string) {
    const signal = await this.signalModel.findById(id).populate('owner', this.publicUserFields).exec();
    if (signal) {
      await this.populateOwnersRank([signal]);
    }
    return this.sanitizeSignal(signal);
  }

  @Public()
  @Get('active')
  activeSignals() {
    return this.signalModel
      .find({
        status: { $in: [SignalStatus.Active, SignalStatus.Pending] },
        deletedAt: null,
      })
      .select(['-messageId', '-_id', '-owner']);
  }

  @Public()
  @Get('tempList')
  async tempListSignals() {
    const signals = await this.signalModel
      .find({
        deletedAt: null,
      })
      .populate('owner', this.publicUserFields)
      .sort({
        createdAt: -1,
      })
      .limit(20);
    await this.populateOwnersRank(signals);
    return this.sanitizeSignals(signals);
  }

  @Public()
  @Get('status/:status')
  async filterStatus(
    @Param('status') status: string,
    @Query('page') page?: string,
    @Query('filter') filter?: 'all' | 'myself' | 'following' | 'bookmarked',
    @Req() req?: any,
  ) {
    const PAGE_SIZE = 20;
    const query: any = {
      deletedAt: null,
    };
    if (status !== 'all') {
      query.status = status;
    }

    const loggedInUserId = this.auth.getUserIdFromRequest(req);

    if (filter === 'myself') {
      if (!loggedInUserId) {
        return [];
      }
      query.owner = loggedInUserId;
    } else if (filter === 'following') {
      if (!loggedInUserId) {
        return [];
      }
      const follows = await this.followModel.find({ follower: loggedInUserId }).exec();
      const followingIds = follows.map((f) => f.following);
      query.owner = { $in: followingIds };
    } else if (filter === 'bookmarked') {
      if (!loggedInUserId) {
        return [];
      }
      const subscriptions = await this.signalSubModel.find({ user: loggedInUserId, followStatus: true }).exec();
      const signalIds = subscriptions.map((s) => s.signal);
      query._id = { $in: signalIds };
    }

    const signals = await this.signalModel
      .find(query)
      .populate('owner', this.publicUserFields)
      .sort({
        createdAt: -1,
      })
      .limit(PAGE_SIZE)
      .skip(page ? Number(page) * PAGE_SIZE : 0);
    await this.populateOwnersRank(signals);
    return this.sanitizeSignals(signals);
  }

  @Post()
  async createSignal(@Body() signal: Signal, @LoginUser() user: User) {
    const res = await this.signalService.addSignal({
      ...signal,
      owner: user,
      createdOuncePrice: this.ouncePriceService.current,
      source: SignalSource.Web,
    });
    if (res) {
      await this.populateOwnersRank([res]);
    }
    return this.sanitizeSignal(res);
  }

  @Post('analyze')
  async analyzeSignal(
    @Body() signal: Signal,
    @Query('tradingStyle') tradingStyle: TradingStyle,
    @Query('riskTolerance') riskTolerance: RiskTolerance,
    @LoginUser() user: User,
  ) {
    const res = await this.signalService.analyzeSignal(
      signal,
      user.id || (user as any)._id,
      { tradingStyle, riskTolerance },
    );
    if (res && res.signal) {
      await this.populateOwnersRank([res.signal]);
      res.signal = this.sanitizeSignal(res.signal);
    }
    return res;
  }

  @Post('generate')
  async generateSignal(
    @Query('tradingStyle') tradingStyle: TradingStyle,
    @Query('riskTolerance') riskTolerance: RiskTolerance,
    @LoginUser() user: User,
  ) {
    return this.signalService.generateSignal(
      user.id || (user as any)._id,
      { tradingStyle, riskTolerance },
    );
  }

  @Delete(':id')
  async cancelSignal(@Param('id') id: string, @LoginUser() user: User) {
    const userId = user.id || (user as any)._id?.toString();
    const res = await this.signalService.cancelSignal(id, userId);
    if (res) {
      await this.populateOwnersRank([res]);
    }
    return this.sanitizeSignal(res);
  }

  @Post(':id/close')
  async manualCloseSignal(@Param('id') id: string, @LoginUser() user: User) {
    const userId = user.id || (user as any)._id?.toString();
    const res = await this.signalService.manualCloseSignal(id, userId);
    if (res) {
      await this.populateOwnersRank([res]);
    }
    return this.sanitizeSignal(res);
  }

  @Post(':id/riskfree')
  async makeSignalRiskFree(@Param('id') id: string, @LoginUser() user: User) {
    const userId = user.id || (user as any)._id?.toString();
    const res = await this.signalService.makeSignalRiskFree(id, userId);
    if (res) {
      await this.populateOwnersRank([res]);
    }
    return this.sanitizeSignal(res);
  }

  @Get(':id/subscription')
  async getSubscription(@Param('id') id: string, @LoginUser() user: User) {
    const userId = user.id || (user as any)._id?.toString();
    const sub = await this.signalService.getSubscription(id, userId);
    return sub || { signal: id, user: userId, followStatus: false, aiShield: false };
  }

  @Post(':id/subscribe')
  async updateSubscription(
    @Param('id') id: string,
    @Body() subDto: { followStatus?: boolean; aiShield?: boolean },
    @LoginUser() user: User,
  ) {
    const userId = user.id || (user as any)._id?.toString();
    return this.signalService.updateSubscription(id, userId, subDto);
  }
}
