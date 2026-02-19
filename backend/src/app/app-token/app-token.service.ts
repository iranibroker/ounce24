import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AppTokenService {
  private readonly tokenExpiry = '15m';

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Issues a short-lived token for an embedded app (game, iframe).
   */
  issueToken(userId: string): string {
    return this.jwtService.sign(
      { id: userId },
      {
        secret: process.env.JWT_ACCESS_SECRET!,
        expiresIn: this.tokenExpiry,
      },
    );
  }
}
