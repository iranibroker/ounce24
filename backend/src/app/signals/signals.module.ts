import { Module } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { SchemasModule } from '../schemas/schemas.module';
import { SignalsController } from './signals.controller';

@Module({
  imports: [SchemasModule],
  providers: [SignalsService],
  controllers: [SignalsController],
})
export class SignalsModule {}
