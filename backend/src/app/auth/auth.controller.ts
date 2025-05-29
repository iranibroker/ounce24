import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { LocalAuthGuard } from './local-auth.guard';
import { PersianNumberService } from '@ounce24/utils';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    console.log(23333)
    return this.auth.login(req.user);
  }

  @Public()
  @Get('sendToken/:mobile')
  async sendToken(@Param() params) {
    return this.auth.sendToken(PersianNumberService.toEnglish(params.mobile));
  }
}
