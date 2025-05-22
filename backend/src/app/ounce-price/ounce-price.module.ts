import { Module } from '@nestjs/common';
import { OuncePriceService } from './ounce-price.service';
import { QuoteService } from './quote.service';
import { OuncePriceController } from './ounce-price.controller';

@Module({
  controllers: [OuncePriceController],
  providers: [OuncePriceService, QuoteService],
  exports: [OuncePriceService],
})
export class OuncePriceModule {}
