import { Controller, Post, Get, Body } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { WebPushService } from './web-push.service';

@Public()
@Controller('web-push')
export class WebPushController {
  constructor(private readonly webPushService: WebPushService) {}

  @Get('vapid-public-key')
  getPublicKey() {
    return {
      publicKey: this.webPushService.getPublicKey(),
    };
  }

  @Post('subscribe')
  async subscribe(@Body() body: any) {
    if (!body || !body.endpoint || !body.keys) {
      return { success: false, error: 'Invalid subscription payload' };
    }
    await this.webPushService.addSubscription(body);
    return { success: true };
  }
}
