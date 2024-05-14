import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Signal, SignalSchema } from '@ounce24/types';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Signal.name, schema: SignalSchema }]),
  ],
  exports: [MongooseModule],
})
export class SchemasModule {}
