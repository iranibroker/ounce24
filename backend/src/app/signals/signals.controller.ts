import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Signal, SignalStatus } from '@ounce24/types';
import { Model } from 'mongoose';

@Controller('signals')
export class SignalsController {
  constructor(@InjectModel(Signal.name) private signalModel: Model<Signal>) {}

  @Get('active')
  activeSignals() {
    return this.signalModel.find({
      status: { $in: [SignalStatus.Active, SignalStatus.Pending] },
      deletedAt: { $ne: null }
    }).select(['-messageId', '-_id', '-owner']);
  }
}
