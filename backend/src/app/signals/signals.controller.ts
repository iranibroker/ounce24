import { Controller, Get, Param, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Signal, SignalStatus } from '@ounce24/types';
import { Model } from 'mongoose';

@Controller('signals')
export class SignalsController {
  constructor(@InjectModel(Signal.name) private signalModel: Model<Signal>) {}

  @Get('active')
  activeSignals() {
    return this.signalModel
      .find({
        status: { $in: [SignalStatus.Active, SignalStatus.Pending] },
        deletedAt: null,
      })
      .select(['-messageId', '-_id', '-owner']);
  }

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
        createdAt: -1,
      })
      .limit(PAGE_SIZE)
      .skip(page ? Number(page) * PAGE_SIZE : 0);
  }
}
