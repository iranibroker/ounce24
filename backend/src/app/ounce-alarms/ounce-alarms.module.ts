import { Module } from '@nestjs/common';

import { OuncePriceModule } from '../ounce-price/ounce-price.module';
import { OunceAlarmsService } from './ounce-alarms.service';

@Module({
  imports: [OuncePriceModule],
  providers: [OunceAlarmsService],
  exports: [OunceAlarmsService],
})
export class OunceAlarmsModule {}

