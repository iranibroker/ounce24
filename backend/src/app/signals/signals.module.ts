import { Module } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { SchemasModule } from '../schemas/schemas.module';
import { SignalsController } from './signals.controller';
import { OuncePriceModule } from '../ounce-price/ounce-price.module';
import { AiChatModule } from '../ai-chat/ai-chat.module';

@Module({
  imports: [SchemasModule, OuncePriceModule, AiChatModule],
  providers: [SignalsService],
  controllers: [SignalsController],
  exports: [SignalsService],
})
export class SignalsModule {}
