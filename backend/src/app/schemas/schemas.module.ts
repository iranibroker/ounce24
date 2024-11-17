import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Signal, User } from '@ounce24/types';
import { UserSchema } from './user.schema';
import { SignalSchema } from './signal.schema';

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
