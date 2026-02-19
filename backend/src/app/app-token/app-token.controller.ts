import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppTokenService } from './app-token.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoginUser } from '../auth/user.decorator';

@Controller('app-token')
@UseGuards(JwtAuthGuard)
export class AppTokenController {
  constructor(private readonly appTokenService: AppTokenService) {}

  /**
   * Returns a short-lived token for embedded apps/games.
   */
  @Get()
  getToken(@LoginUser() user: { id: string }) {
    const token = this.appTokenService.issueToken(user.id);
    return { token };
  }
}
