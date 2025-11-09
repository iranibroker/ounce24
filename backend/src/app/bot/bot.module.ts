import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { SchemasModule } from '../schemas/schemas.module';
import { SignalBotService } from './signal-bot.service';
import { PublishBotsService } from './publish-bots.service';
import { OuncePublishBotService } from './ounce-publish-bot.service';
import { UserStatsService } from './user-stats.service';
import { AuthModule } from '../auth/auth.module';
import { ConsultingBotService } from './consulting-bot.service';
import { SignalsModule } from '../signals/signals.module';
import { UsersModule } from '../users/users.module';
import { OuncePriceModule } from '../ounce-price/ounce-price.module';
import { OunceAlarmsModule } from '../ounce-alarms/ounce-alarms.module';
import { OunceAlarmBotService } from './ounce-alarm-bot.service';

@Module({
  imports: [
    SchemasModule,
    AuthModule,
    SignalsModule,
    OunceAlarmsModule,
    UsersModule,
    OuncePriceModule,
  ],
  providers: [
    SignalBotService,
    OunceAlarmBotService,
    BotService,
    PublishBotsService,
    OuncePublishBotService,
    UserStatsService,
    ConsultingBotService,
  ],
  exports: [BotService],
})
export class BotModule {}
