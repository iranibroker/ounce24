import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
  constructor(
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    private readonly signalService: SignalsService,
    private readonly ouncePriceService: OuncePriceService,
  ) {}

  @Public()
  @Get('today')
  todaySignals() {
    const date = new Date();
    date.setHours(0,0,0,0);
    return this.signalModel
      .find({
        closedAt: { $gte: date },
        status: SignalStatus.Closed,
        deletedAt: null
      })
      .sort({
        updatedAt: -1
      }).exec();
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
  getSignal(@Param('id') id: string) {
    return this.signalModel.findById(id).populate(['owner']).exec();
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
  tempListSignals() {
    return this.signalModel
      .find({
        deletedAt: null,
      })
      .populate(['owner'])
      .sort({
        createdAt: -1,
      })
      .limit(20);
  }

  @Public()
  @Get('status/:status')
  filterStatus(
    @Param('status') status: SignalStatus,
    @Query('page') page?: string,
  ) {
    const PAGE_SIZE = 20;
    return this.signalModel
      .find({
        deletedAt: null,
        status,
        publishable: true,
      })
      .populate(['owner'])
      .sort({
        updatedAt: -1,
      })
      .limit(PAGE_SIZE)
      .skip(page ? Number(page) * PAGE_SIZE : 0);
  }

  @Post()
  createSignal(@Body() signal: Signal, @LoginUser() user: User) {
    return this.signalService.addSignal({
      ...signal,
      owner: user,
      createdOuncePrice: this.ouncePriceService.current,
      source: SignalSource.Web,
    });
  }

  @Post('analyze')
  async analyzeSignal(@Body() signal: Signal, @LoginUser() user: User) {
    // Check if user has gems
    return this.signalService.analyzeSignal(signal, user);
  }
}
