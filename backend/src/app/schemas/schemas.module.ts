import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Signal, User, GemLog, Podcast, Achievement, SignalAnalyze, OctopusPrediction, OuncePriceCandle, SignalSubscription } from '@ounce24/types';
import { UserSchema } from './user.schema';
import { SignalSchema } from './signal.schema';
import { SignalAnalyzeSchema } from './signal-analyze.schema';
import { GemLogSchema } from './gem-log.schema';
import { PodcastSchema } from './podcast.schema';
import { AchievementSchema } from './achievement.schema';
import { OctopusPredictionSchema } from './octopus-prediction.schema';
import { PushSubscription, PushSubscriptionSchema } from './push-subscription.schema';
import { OuncePriceCandleSchema } from './ounce-price-candle.schema';
import { SignalSubscriptionSchema } from './signal-subscription.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Signal.name, schema: SignalSchema },
      { name: SignalAnalyze.name, schema: SignalAnalyzeSchema },
      { name: User.name, schema: UserSchema },
      { name: GemLog.name, schema: GemLogSchema },
      { name: Podcast.name, schema: PodcastSchema },
      { name: Achievement.name, schema: AchievementSchema },
      { name: OctopusPrediction.name, schema: OctopusPredictionSchema },
      { name: PushSubscription.name, schema: PushSubscriptionSchema },
      { name: OuncePriceCandle.name, schema: OuncePriceCandleSchema },
      { name: SignalSubscription.name, schema: SignalSubscriptionSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class SchemasModule {}
