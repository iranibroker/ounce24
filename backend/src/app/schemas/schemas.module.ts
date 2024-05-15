import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Signal, SignalSchema, User, UserSchema } from '@ounce24/types';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Signal.name, schema: SignalSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class SchemasModule {}
