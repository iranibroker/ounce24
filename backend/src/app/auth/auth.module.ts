import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SchemasModule } from '../schemas/schemas.module';

@Module({
  imports: [SchemasModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
