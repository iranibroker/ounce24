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
  @Post('telegram-login')
  async telegramLogin(@Body() body: { initData: string }) {
    return this.auth.telegramLogin(body.initData);
  }

  @Public()
  @Post('telegram-widget-login')
  async telegramWidgetLogin(@Body() body: any) {
    return this.auth.telegramWidgetLogin(body);
  }

  @Public()
  @Post('telegram-oidc-login')
  async telegramOidcLogin(@Body() body: { code: string; redirectUri: string }) {
    return this.auth.telegramOidcLogin(body.code, body.redirectUri);
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
    return this.auth.getUserInfo(user.id, true);
  }

  @Patch('me')
  async updateMe(@LoginUser() user, @Body() body) {
    return this.auth.updateUser(user.id, body);
  }

  @Patch('me/notification-settings')
  async updateNotificationSettings(
    @LoginUser() user,
    @Body() body: { notifPrice?: boolean; notifSignalFollow?: boolean; notifAiShield?: boolean },
  ) {
    return this.auth.updateNotificationSettings(user.id, body);
  }

  @Post('me/telegram-avatar')
  async useTelegramAvatar(@LoginUser() user) {
    return this.auth.useTelegramAvatar(user.id);
  }

  @Post('me/google-avatar')
  async useGoogleAvatar(@LoginUser() user) {
    return this.auth.useGoogleAvatar(user.id);
  }

}
