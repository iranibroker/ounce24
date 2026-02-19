import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppTokenController } from './app-token.controller';
import { AppTokenService } from './app-token.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AppTokenController],
  providers: [AppTokenService],
  exports: [AppTokenService],
})
export class AppTokenModule {}
