import { Module } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { SchemasModule } from '../schemas/schemas.module';
import { SignalsController } from './signals.controller';
import { OuncePriceModule } from '../ounce-price/ounce-price.module';

@Module({
  imports: [SchemasModule, OuncePriceModule],
  providers: [SignalsService],
  controllers: [SignalsController],
  exports: [SignalsService],
})
export class SignalsModule {}
