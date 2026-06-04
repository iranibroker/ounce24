import { Body, Controller, Get, Param, Post, Query, Delete, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  GemLog,
  Signal,
  SignalSource,
  SignalStatus,
  User,
} from '@ounce24/types';
import { Model } from 'mongoose';
import { Public } from '../auth/public.decorator';
import { LoginUser } from '../auth/user.decorator';
import { SignalsService } from './signals.service';
import { OuncePriceService } from '../ounce-price/ounce-price.service';

@Controller('signals')
export class SignalsController {
  private readonly publicUserFields =
    'name title avatar avatarSource avgRiskReward score totalScore totalSignals winRate weekScore createdAt';

  constructor(
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    private readonly signalService: SignalsService,
    private readonly ouncePriceService: OuncePriceService,
  ) {}

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
  @Get(':id')
  async getSignal(@Param('id') id: string) {
    const signal = await this.signalModel.findById(id).populate('owner', this.publicUserFields).exec();
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
    return this.sanitizeSignals(signals);
  }

  @Public()
  @Get('status/:status')
  async filterStatus(
    @Param('status') status: SignalStatus,
    @Query('page') page?: string,
  ) {
    const PAGE_SIZE = 20;
    const signals = await this.signalModel
      .find({
        deletedAt: null,
        status,
      })
      .populate('owner', this.publicUserFields)
      .sort({
        updatedAt: -1,
      })
      .limit(PAGE_SIZE)
      .skip(page ? Number(page) * PAGE_SIZE : 0);
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
    return this.sanitizeSignal(res);
  }

  @Post('analyze')
  async analyzeSignal(@Body() signal: Signal, @LoginUser() user: User) {
    const res = await this.signalService.analyzeSignal(signal, user.id || (user as any)._id);
    if (res && res.signal) {
      res.signal = this.sanitizeSignal(res.signal);
    }
    return res;
  }

  @Post('generate')
  async generateSignal(@LoginUser() user: User) {
    return this.signalService.generateSignal(user.id || (user as any)._id);
  }

  @Delete(':id')
  async cancelSignal(@Param('id') id: string, @LoginUser() user: User) {
    const userId = user.id || (user as any)._id?.toString();
    const res = await this.signalService.cancelSignal(id, userId);
    return this.sanitizeSignal(res);
  }

  @Post(':id/close')
  async manualCloseSignal(@Param('id') id: string, @LoginUser() user: User) {
    const userId = user.id || (user as any)._id?.toString();
    const res = await this.signalService.manualCloseSignal(id, userId);
    return this.sanitizeSignal(res);
  }

  @Post(':id/riskfree')
  async makeSignalRiskFree(@Param('id') id: string, @LoginUser() user: User) {
    const userId = user.id || (user as any)._id?.toString();
    const res = await this.signalService.makeSignalRiskFree(id, userId);
    return this.sanitizeSignal(res);
  }
}
