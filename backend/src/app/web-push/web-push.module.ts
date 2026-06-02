import { Module } from '@nestjs/common';
import { WebPushService } from './web-push.service';
import { WebPushController } from './web-push.controller';
import { OuncePriceModule } from '../ounce-price/ounce-price.module';
import { SchemasModule } from '../schemas/schemas.module';

@Module({
  imports: [OuncePriceModule, SchemasModule],
  controllers: [WebPushController],
  providers: [WebPushService],
  exports: [WebPushService],
})
export class WebPushModule {}
