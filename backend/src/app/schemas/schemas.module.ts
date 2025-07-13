import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Signal, User, GemLog, Podcast } from '@ounce24/types';
import { UserSchema } from './user.schema';
import { SignalSchema } from './signal.schema';
import { GemLogSchema } from './gem-log.schema';
import { PodcastSchema } from './podcast.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Signal.name, schema: SignalSchema },
      { name: User.name, schema: UserSchema },
      { name: GemLog.name, schema: GemLogSchema },
      { name: Podcast.name, schema: PodcastSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class SchemasModule {}
