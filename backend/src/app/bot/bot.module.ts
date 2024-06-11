import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { SchemasModule } from '../schemas/schemas.module';
import { SignalBotService } from './signal-bot.service';
import { OuncePriceModule } from '../ounce-price/ounce-price.module';
import { PublishBotsService } from './publish-bots.service';
import { OuncePublishBotService } from './ounce-publish-bot.service';
import { UserStatsService } from './user-stats.service';

@Module({
  imports: [SchemasModule, OuncePriceModule],
  providers: [
    SignalBotService,
    BotService,
    PublishBotsService,
    OuncePublishBotService,
    UserStatsService,
  ],
  exports: [BotService],
})
export class BotModule {}
