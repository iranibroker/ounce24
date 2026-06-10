import { Module } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { SignalCopilotService } from './signal-copilot.service';
import { SchemasModule } from '../schemas/schemas.module';
import { SignalsController } from './signals.controller';
import { OuncePriceModule } from '../ounce-price/ounce-price.module';
import { AiModule } from '../ai/ai.module';
import { WebPushModule } from '../web-push/web-push.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SchemasModule, OuncePriceModule, AiModule, WebPushModule, AuthModule],
  providers: [SignalsService, SignalCopilotService],
  controllers: [SignalsController],
  exports: [SignalsService, SignalCopilotService],
})
export class SignalsModule {}
