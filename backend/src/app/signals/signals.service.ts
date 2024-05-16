import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Signal } from '@ounce24/types';
import { Model } from 'mongoose';

@Injectable()
export class SignalsService {
  constructor(@InjectModel(Signal.name) private signalModel: Model<Signal>) {
    // setTimeout(() => {
    //   this.findAll().then((all) => {
    //     console.log(all);
    //   });
    // }, 3000);
  }

  async create(
    dto: Pick<Signal, 'type' | 'entryPrice' | 'maxPrice' | 'minPrice'>
  ): Promise<Signal> {
    const createdData = new this.signalModel(dto);
    return createdData.save();
  }

  async findAll(): Promise<Signal[]> {
    return this.signalModel.find().exec();
  }
}
