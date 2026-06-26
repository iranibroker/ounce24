import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OuncePriceService } from './ounce-price.service';
import { QuoteService } from './quote.service';
import { OuncePriceController } from './ounce-price.controller';
import { OuncePriceHistoryService } from './ounce-price-history.service';
import { SchemasModule } from '../schemas/schemas.module';
import { MetaapiPriceTestService } from './metaapi-price-test.service';

@Module({
  imports: [SchemasModule, ConfigModule],
  controllers: [OuncePriceController],
  providers: [
    OuncePriceService,
    QuoteService,
    OuncePriceHistoryService,
    MetaapiPriceTestService,
  ],
  exports: [OuncePriceService, OuncePriceHistoryService],
})
export class OuncePriceModule {}
