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

@Module({
  imports: [SchemasModule, AuthModule, SignalsModule],
  providers: [
    SignalBotService,
    BotService,
    PublishBotsService,
    OuncePublishBotService,
    UserStatsService,
    ConsultingBotService,
  ],
  exports: [BotService],
})
export class BotModule {}
