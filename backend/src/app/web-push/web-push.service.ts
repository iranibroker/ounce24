import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as webpush from 'web-push';
import { PushSubscription } from '../schemas/push-subscription.schema';
import { OuncePriceService } from '../ounce-price/ounce-price.service';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS } from '../consts';
import { User } from '@ounce24/types';

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly publicKey =
    process.env.VAPID_PUBLIC_KEY ||
    'BAfEWI8MCMIEIPtMJO08_ChNDtsT4PIOJUj4qe6mWv4JxCRHCQsXuTBvlnljeSOR223m-9TiFKGkberbEYsFJL8';
  private readonly privateKey =
    process.env.VAPID_PRIVATE_KEY || '2mAAqmtRT424CdooL1b9iEgGfNwzLuMKEqV6_VML414';
  private readonly email = process.env.VAPID_EMAIL || 'mailto:admin@ounce24.com';

  constructor(
    @InjectModel(PushSubscription.name)
    private readonly pushSubModel: Model<PushSubscription>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly ouncePriceService: OuncePriceService,
  ) {}

  onModuleInit() {
    try {
      webpush.setVapidDetails(this.email, this.publicKey, this.privateKey);
      console.log('WebPush Service successfully initialized with VAPID keys.');
    } catch (error) {
      console.error('Failed to set VAPID details for web-push:', error);
    }
  }

  getPublicKey() {
    return this.publicKey;
  }

  async addSubscription(subscription: any, userId?: string) {
    const existing = await this.pushSubModel.findOne({ endpoint: subscription.endpoint });
    if (existing) {
      existing.keys = subscription.keys;
      existing.userId = userId || null;
      return await existing.save();
    } else {
      const newSub = new this.pushSubModel({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        expirationTime: subscription.expirationTime,
        userId: userId || null,
      });
      return await newSub.save();
    }
  }

  async removeSubscription(endpoint: string) {
    await this.pushSubModel.deleteOne({ endpoint });
  }

  /** ارسال به همه اشتراک‌هایی که notifPrice = true دارند */
  async sendNotificationToAll(payload: string) {
    // کاربرانی که notifPrice صریحاً false ندارند
    const disabledUserIds = await this.userModel
      .find({ notifPrice: false })
      .select('_id')
      .lean()
      .then((users) => users.map((u) => String(u._id)));

    const subscriptions = await this.pushSubModel.find();
    if (subscriptions.length === 0) return;

    const promises = subscriptions
      .filter((sub) => {
        if (!sub.userId) return true; // اشتراک‌های بدون یوزر همیشه دریافت می‌کنند
        return !disabledUserIds.includes(sub.userId);
      })
      .map((sub) => {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        };

        const options = {
          TTL: 0,
          urgency: 'high' as const,
        };

        return webpush.sendNotification(pushSub, payload, options).catch(async (error) => {
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`Removing expired subscription: ${sub.endpoint}`);
            await this.removeSubscription(sub.endpoint);
          } else {
            console.error(`Failed to send web push notification to ${sub.endpoint}:`, error);
          }
        });
      });

    await Promise.all(promises);
  }

  async sendNotificationToUser(userId: string, payload: string) {
    if (!userId) return;
    const subscriptions = await this.pushSubModel.find({ userId });
    if (subscriptions.length === 0) return;

    const promises = subscriptions.map((sub) => {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      };

      const options = {
        TTL: 0,
        urgency: 'high' as const,
      };

      return webpush.sendNotification(pushSub, payload, options).catch(async (error) => {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`Removing expired subscription: ${sub.endpoint}`);
          await this.removeSubscription(sub.endpoint);
        } else {
          console.error(`Failed to send web push notification to user ${userId} subscription ${sub.endpoint}:`, error);
        }
      });
    });

    await Promise.all(promises);
  }

  @OnEvent(EVENTS.OUNCE_PRICE_UPDATED)
  async handlePriceBroadcasting(price: number) {
    if (price > 0) {
      const payload = JSON.stringify({ price });
      await this.sendNotificationToAll(payload);
    }
  }
}
