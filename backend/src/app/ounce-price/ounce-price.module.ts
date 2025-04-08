import { Module } from '@nestjs/common';
import { OuncePriceService } from './ounce-price.service';
import { QuoteService } from './quote.service';

@Module({
  providers: [OuncePriceService, QuoteService],
  exports: [OuncePriceService],
})
export class OuncePriceModule {}
