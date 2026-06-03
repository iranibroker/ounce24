import { Module } from '@nestjs/common';
import { OuncePriceService } from './ounce-price.service';
import { QuoteService } from './quote.service';
import { OuncePriceController } from './ounce-price.controller';
import { OuncePriceHistoryService } from './ounce-price-history.service';
import { SchemasModule } from '../schemas/schemas.module';

@Module({
  imports: [SchemasModule],
  controllers: [OuncePriceController],
  providers: [OuncePriceService, QuoteService, OuncePriceHistoryService],
  exports: [OuncePriceService, OuncePriceHistoryService],
})
export class OuncePriceModule {}
