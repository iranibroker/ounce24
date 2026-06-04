import { Controller, Post, Get, Body } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { WebPushService } from './web-push.service';
import { LoginUser } from '../auth/user.decorator';

@Controller('web-push')
export class WebPushController {
  constructor(private readonly webPushService: WebPushService) {}

  @Public()
  @Get('vapid-public-key')
  getPublicKey() {
    return {
      publicKey: this.webPushService.getPublicKey(),
    };
  }

  @Post('subscribe')
  async subscribe(@LoginUser() user, @Body() body: any) {
    if (!body || !body.endpoint || !body.keys) {
      return { success: false, error: 'Invalid subscription payload' };
    }
    await this.webPushService.addSubscription(body, user?.id);
    return { success: true };
  }

  @Post('unsubscribe')
  async unsubscribe(@LoginUser() user, @Body() body: { endpoint: string }) {
    if (!body || !body.endpoint) {
      return { success: false, error: 'Invalid unsubscribe payload' };
    }
    await this.webPushService.removeSubscription(body.endpoint);
    return { success: true };
  }
}
