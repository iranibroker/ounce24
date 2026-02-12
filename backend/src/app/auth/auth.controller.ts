import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { LocalAuthGuard } from './local-auth.guard';
import { PersianNumberService } from '@ounce24/utils';
import { LoginUser } from './user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.auth.login(req.user);
  }

  @Public()
  @Post('telegram-login')
  async telegramLogin(@Body() body: { initData: string }) {
    return this.auth.telegramLogin(body.initData);
  }

  @Public()
  @Post('google-login')
  async googleLogin(@Body() body: { idToken?: string; credential?: string }) {
    const token = body.idToken ?? body.credential;
    if (!token) {
      throw new BadRequestException('idToken or credential is required');
    }
    return this.auth.googleLogin(token);
  }

  @Public()
  @Get('sendToken/:mobile')
  async sendToken(@Param() params) {
    return this.auth.sendToken(PersianNumberService.toEnglish(params.mobile));
  }

  @Get('me')
  async getMe(@LoginUser() user) {
    return this.auth.getUserInfo(user.id);
  }

  @Patch('me')
  async updateMe(@LoginUser() user, @Body() body) {
    return this.auth.updateUser(user.id, body);
  }

  @Post('me/telegram-avatar')
  async useTelegramAvatar(@LoginUser() user) {
    if (!user.telegramId) {
      throw new BadRequestException({
        translationKey: 'profile.avatar.noTelegram',
      });
    }
    const photoUrl = await this.auth.fetchTelegramAvatarUrl(user.telegramId);
    if (!photoUrl) {
      throw new BadRequestException({
        translationKey: 'profile.avatar.telegramFetchFailed',
      });
    }
    return this.auth.updateUser(user.id, { avatar: photoUrl });
  }
}
