import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as Kavenegar from 'kavenegar';
import { PersianNumberService } from '@ounce24/utils';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '@ounce24/types';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { createHmac } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
let kavenegarApi;

@Injectable()
export class AuthService {
  mobilePhoneTokens: { [key: string]: string } = {};
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private http: HttpService,
  ) {
    kavenegarApi = Kavenegar.KavenegarApi({
      apikey: process.env.KAVENEGAR_API_KEY,
    });
  }

  async validateUser(username: string, pass: string): Promise<User> {
    const phone = PersianNumberService.toEnglish(username);
    let user = await this.userModel.findOne({ phone });

    if (!user) {
      user = await this.userModel.create({ phone });
    }

    if (this.checkToken(phone, pass)) return user;

    throw new BadRequestException();
  }

  login(user: User, expireTokenIn = '365d') {
    const payload = {
      id: user.id,
      phone: user.phone,
    };

    const token = this.jwtService.sign(payload as any, {
      secret: process.env.JWT_ACCESS_SECRET!,
      expiresIn: expireTokenIn,
    } as any);

    return token;
  }

  async createAlternativeTelegramToken(telegramId: number) {
    const user = await this.userModel.findOne({ telegramId });
    if (user) {
      const payload = {
        id: user.id,
        phone: user.phone,
      };

      const token = this.jwtService.sign(payload as any, {
        secret: process.env.JWT_ACCESS_SECRET!,
        expiresIn: '3d',
      } as any);
      return token;
    }
  }

  async sendToken(mobilePhone: string, validateTime = 70000) {
    const phone = PersianNumberService.toEnglish(mobilePhone);
    const token = Math.floor(Math.random() * 8000 + 1000).toString();
    if (this.mobilePhoneTokens[phone])
      throw new HttpException(
        {
          translationKey: 'auth.duplicate',
        },
        HttpStatus.CONFLICT,
      );
    console.log('sendToken', phone, token);
    await this.lookup(phone, process.env.KAVENEGAR_OTP, token);
    this.mobilePhoneTokens[phone] = token;
    setTimeout(() => {
      delete this.mobilePhoneTokens[phone];
    }, validateTime);
    const user = await this.userModel.findOne({ phone });
    return user;
  }

  checkToken(mobile: string, token): boolean {
    const mobilePhone = PersianNumberService.toEnglish(mobile);
    console.log('checkToken', mobilePhone, token, this.mobilePhoneTokens[mobilePhone]);
    const defaultOtp = process.env.DEFAULT_OTP_PASSWORD;
    return (
      this.mobilePhoneTokens[mobilePhone]?.toString() ===
        PersianNumberService.toEnglish(token)?.toString() ||
      (defaultOtp != null && defaultOtp !== '' && token === defaultOtp)
    );
  }

  async lookup(mobilePhone: string, kavenagarTemplate: string, token: string) {
    return this.http
      .get<void>(
        `https://uptodate-api-proxy-utils.darkube.app/kavenegar/lookup/${kavenagarTemplate}/${mobilePhone}/${token}`,
      )
      .toPromise();
  }

  async getUserInfo(userId: string) {
    const user = (await this.userModel.findById(userId)).toJSON();

    if (!user) {
      throw new NotFoundException({
        translationKey: 'userNotFound',
      });
    }

    const rank = await this.userModel
      .countDocuments({
        totalScore: { $gt: user.totalScore },
      })
      .exec();
    user.rank = rank + 1;
    return user;
  }

  async updateUser(userId: string, body: Partial<User>) {
    const user = await this.userModel.findByIdAndUpdate(userId, body, {
      new: true,
    });
    return user;
  }

  async fetchTelegramAvatarUrl(telegramId: number): Promise<string | null> {
    const token = process.env.BOT_TOKEN;
    if (!token) return null;
    try {
      const photosRes = await this.http
        .get(
          `https://api.telegram.org/bot${token}/getUserProfilePhotos?user_id=${telegramId}&limit=1`,
        )
        .toPromise();
      const photos = photosRes?.data?.result?.photos;
      if (!photos?.[0]?.[0]?.file_id) return null;
      const fileRes = await this.http
        .get(
          `https://api.telegram.org/bot${token}/getFile?file_id=${photos[0][0].file_id}`,
        )
        .toPromise();
      const filePath = fileRes?.data?.result?.file_path;
      if (!filePath) return null;
      return `https://api.telegram.org/file/bot${token}/${filePath}`;
    } catch {
      return null;
    }
  }

  async telegramLogin(initData: string) {
    if (!this.validateTelegramData(initData)) {
      throw new BadRequestException('Invalid Telegram data');
    }

    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (!userStr) {
      throw new BadRequestException('User data missing');
    }

    const telegramUser = JSON.parse(userStr);
    const telegramId = telegramUser.id;

    let user = await this.userModel.findOne({ telegramId });

    if (!user) {
      // Try to find by username if available, though telegramId is safer
      if (telegramUser.username) {
        user = await this.userModel.findOne({
          telegramUsername: telegramUser.username,
        });
        if (user) {
          user.telegramId = telegramId;
          await user.save();
        }
      }
    }

    if (!user) {
       // Create new user from Telegram data without phone number
       user = await this.userModel.create({
         telegramId: telegramId,
         name: telegramUser.first_name,
         telegramUsername: telegramUser.username,
         avatar: telegramUser.photo_url
       });
    } else {
        // Update user info
        let updated = false;
        if (user.name !== telegramUser.first_name) {
            user.name = telegramUser.first_name;
            updated = true;
        }
        if (user.telegramUsername !== telegramUser.username) {
            user.telegramUsername = telegramUser.username;
            updated = true;
        }
        if (telegramUser.photo_url && user.avatar !== telegramUser.photo_url) {
            user.avatar = telegramUser.photo_url;
            updated = true;
        }
        if (updated) await user.save();
    }

    return {
      token: this.login(user),
      user: user
    };
  }

  async googleLogin(idToken: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException('Google login is not configured');
    }

    if (!idToken || typeof idToken !== 'string' || idToken.length < 100) {
      throw new BadRequestException('Invalid Google token: missing or invalid');
    }

    const trimmedToken = idToken.trim();
    let payload: {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    } | null = null;

    // 1) Try tokeninfo first (single GET, no cert fetch) – works when cert endpoint is 403
    payload = await this.verifyGoogleTokenViaTokenInfo(trimmedToken, clientId);

    // 2) Fallback to verifyIdToken (fetches Google certs; can 403 in restricted networks)
    if (!payload) {
      try {
        const client = new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({
          idToken: trimmedToken,
          audience: clientId,
        });
        const p = ticket.getPayload();
        if (p?.sub) payload = p;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('audience') || message.includes('Audience')) {
          throw new BadRequestException(
            'Invalid Google token: client ID mismatch. Ensure GOOGLE_CLIENT_ID on the server matches the Web client ID used in the app.',
          );
        }
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Google verifyIdToken error:', message);
        }
        throw new BadRequestException('Invalid Google token');
      }
    }

    if (!payload?.sub) {
      throw new BadRequestException('Invalid Google token');
    }

    const googleId = payload.sub;

    let user = await this.userModel.findOne({ googleId });

    if (!user) {
      user = await this.userModel.create({
        googleId,
        email: payload.email ?? undefined,
        name: payload.name ?? undefined,
        avatar: payload.picture ?? undefined,
      });
    } else {
      let updated = false;
      if (payload.email != null && user.email !== payload.email) {
        user.email = payload.email;
        updated = true;
      }
      if (payload.name != null && user.name !== payload.name) {
        user.name = payload.name;
        updated = true;
      }
      if (payload.picture != null && user.avatar !== payload.picture) {
        user.avatar = payload.picture;
        updated = true;
      }
      if (updated) await user.save();
    }

    return {
      token: this.login(user),
      user,
    };
  }

  /**
   * Fallback when verifyIdToken fails (e.g. 403 fetching certs).
   * Uses Google's tokeninfo endpoint; works from networks where cert endpoint is blocked.
   */
  private async verifyGoogleTokenViaTokenInfo(
    idToken: string,
    clientId: string,
  ): Promise<{ sub: string; email?: string; name?: string; picture?: string } | null> {
    try {
      const proxyUrl = process.env.GOOGLE_HTTP_PROXY || process.env.HTTPS_PROXY;
      const proxy = proxyUrl ? this.parseProxyUrl(proxyUrl) : undefined;
      const res = await this.http
        .get<{ sub?: string; aud?: string; email?: string; name?: string; picture?: string }>(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
          proxy ? { proxy } : {},
        )
        .toPromise();
      const data = res?.data;
      if (!data?.sub) return null;
      const aud = data.aud;
      const audienceMatch = Array.isArray(aud) ? aud.includes(clientId) : aud === clientId;
      if (!audienceMatch) return null;
      return {
        sub: data.sub,
        email: data.email,
        name: data.name,
        picture: data.picture,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Google tokeninfo error:', msg);
      }
      return null;
    }
  }

  validateTelegramData(initData: string): boolean {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    urlParams.sort();

    let dataCheckString = '';
    for (const [key, value] of urlParams.entries()) {
      dataCheckString += `${key}=${value}\n`;
    }
    dataCheckString = dataCheckString.slice(0, -1);

    const secret = createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
    const calculatedHash = createHmac('sha256', secret as any).update(dataCheckString).digest('hex');

    return calculatedHash === hash;
  }
}

