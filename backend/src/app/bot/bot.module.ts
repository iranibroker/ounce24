import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { SchemasModule } from '../schemas/schemas.module';
import { SignalBotService } from './signal-bot.service';

@Module({
  imports: [SchemasModule],
  providers: [SignalBotService, BotService],
  exports: [BotService],
})
export class BotModule {}
