import { Module } from '@nestjs/common';
import { OctopusController } from './octopus.controller';
import { OctopusService } from './octopus.service';
import { SchemasModule } from '../schemas/schemas.module';
import { OuncePriceModule } from '../ounce-price/ounce-price.module';

@Module({
  imports: [SchemasModule, OuncePriceModule],
  controllers: [OctopusController],
  providers: [OctopusService],
  exports: [OctopusService],
})
export class OctopusModule {}
