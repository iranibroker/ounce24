import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { SchemasModule } from '../schemas/schemas.module';
import { SignalBotService } from './signal-bot.service';
import { OuncePriceModule } from '../ounce-price/ounce-price.module';

@Module({
  imports: [SchemasModule, OuncePriceModule],
  providers: [SignalBotService, BotService],
  exports: [BotService],
})
export class BotModule {}
