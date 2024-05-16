import { Module } from '@nestjs/common';
import { OuncePriceService } from './ounce-price.service';

@Module({
  providers: [OuncePriceService],
  exports: [OuncePriceService],
})
export class OuncePriceModule {}
