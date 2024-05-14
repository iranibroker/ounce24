import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { SchemasModule } from '../schemas/schemas.module';

@Module({
  imports: [SchemasModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
