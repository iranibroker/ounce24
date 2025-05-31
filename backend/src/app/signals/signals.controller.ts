import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Signal, SignalStatus, User } from '@ounce24/types';
import { Model } from 'mongoose';
import { Public } from '../auth/public.decorator';
import { LoginUser } from '../auth/user.decorator';
import { SignalsService } from './signals.service';

@Controller('signals')
export class SignalsController {
  constructor(
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    private readonly signalService: SignalsService,
  ) {}

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
    return this.signalService.addSignal({ ...signal, owner: user });
  }
}
