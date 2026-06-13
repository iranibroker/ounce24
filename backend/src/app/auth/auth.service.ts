import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import * as Kavenegar from 'kavenegar';
import { isValidUserTitle, PersianNumberService, sanitizeUserTitle } from '@ounce24/utils';
import { InjectModel } from '@nestjs/mongoose';
import { User, Follow } from '@ounce24/types';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { createHash, createHmac, createPublicKey } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
let kavenegarApi;

@Injectable()
export class AuthService implements OnModuleDestroy {
  mobilePhoneTokens: { [key: string]: string } = {};
  private cachedBotUsername: string | null = null;
  private readonly redis: Redis;
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Follow.name) private followModel: Model<Follow>,
    private jwtService: JwtService,
    private http: HttpService,
  ) {
    kavenegarApi = Kavenegar.KavenegarApi({
      apikey: process.env.KAVENEGAR_API_KEY,
    });
    this.redis = new Redis(process.env.REDIS_URI + process.env.REDIS_APP_CONFIG_DB);
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch (err) {
      console.error('Failed to close Redis client in AuthService:', err);
    }
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

  /**
   * Find or create a user by Telegram ID. Creates user from Telegram data when not found (no phone required).
   */
  async findOrCreateUserByTelegram(
    telegramId: number,
    data?: { first_name?: string; last_name?: string; username?: string },
  ): Promise<User> {
    let user = await this.userModel.findOne({ telegramId });
    if (user) return user;

    if (data?.username) {
      const escapedUsername = data.username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      user = await this.userModel.findOne({
        telegramUsername: { $regex: new RegExp(`^${escapedUsername}$`, 'i') },
      });
      if (user && (!user.telegramId || user.telegramId === telegramId)) {
        user.telegramId = telegramId;
        if (data.first_name) user.name = [data.first_name, data.last_name].filter(Boolean).join(' ');
        user.telegramUsername = data.username;
        await user.save();
        return user;
      } else {
        user = null;
      }
    }

    const name = [data?.first_name, data?.last_name].filter(Boolean).join(' ') || `User ${telegramId}`;
    const rawTitle = data?.first_name || data?.username || `tg_${telegramId}`;
    const title = sanitizeUserTitle(rawTitle) || `u${String(telegramId).slice(-6)}`;
    return this.userModel.create({
      telegramId,
      name,
      telegramUsername: data?.username,
      title,
    });
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

  async populateUsersRank(users: any[]): Promise<void> {
    const validUsers = (users || []).filter((u) => u && (u._id || u.id));
    if (validUsers.length === 0) return;

    const pipeline = this.redis.pipeline();
    const userIds = validUsers.map((u) => (u._id || u.id).toString());

    for (const id of userIds) {
      pipeline.zrevrank('ounce:leaderboard:totalScore', id);
    }

    const results = await pipeline.exec();

    validUsers.forEach((user, index) => {
      const res = results[index];
      const err = res ? res[0] : null;
      const rankVal = res ? res[1] : null;
      const rank = err || rankVal === null ? null : (rankVal as number) + 1;
      
      user.rank = rank;
      if (user._doc) {
        user._doc.rank = rank;
      }
    });
  }

  async getUserInfo(userId: string, isOwner = false, loggedInUserId?: string | null) {
    let user = (await this.userModel.findById(userId)).toJSON();

    if (!user) {
      throw new NotFoundException({
        translationKey: 'userNotFound',
      });
    }

    await this.populateUsersRank([user]);

    const followersCount = await this.followModel.countDocuments({ following: userId }).exec();
    const followingCount = await this.followModel.countDocuments({ follower: userId }).exec();
    let isFollowing = false;
    if (loggedInUserId && loggedInUserId !== userId) {
      const followRelation = await this.followModel.findOne({
        follower: loggedInUserId,
        following: userId,
      }).exec();
      isFollowing = !!followRelation;
    }

    user.followersCount = followersCount;
    user.followingCount = followingCount;
    user.isFollowing = isFollowing;

    if (!isOwner) {
      user = this.sanitizeUser(user);
    }
    return user;
  }

  getUserIdFromToken(token?: string): string | null {
    if (!token) return null;
    try {
      const decoded = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET!,
      });
      return decoded?.id || null;
    } catch {
      return null;
    }
  }

  getUserIdFromRequest(req: any): string | null {
    const authHeader = req?.headers?.authorization;
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
    return this.getUserIdFromToken(parts[1]);
  }

  sanitizeUser(user: any): any {
    if (!user) return user;
    const publicFields = [
      'id',
      '_id',
      'name',
      'title',
      'tag',
      'defaultScore',
      'avatar',
      'avatarSource',
      'avgRiskReward',
      'score',
      'totalScore',
      'totalSignals',
      'winRate',
      'weekScore',
      'createdAt',
      'updatedAt',
      'rank',
      'followersCount',
      'followingCount',
      'isFollowing',
    ];
    const sanitized: any = {};
    for (const field of publicFields) {
      if (user[field] !== undefined) {
        sanitized[field] = user[field];
      }
    }
    return sanitized;
  }

  async updateUser(userId: string, body: Partial<User>) {
    const updates = { ...body };
    if (updates.title != null) {
      if (!isValidUserTitle(updates.title)) {
        throw new BadRequestException({
          translationKey: 'profile.title.invalid',
        });
      }
      updates.title = sanitizeUserTitle(updates.title);
    }
    const user = await this.userModel.findByIdAndUpdate(userId, updates, {
      new: true,
    });
    return user;
  }

  async updateNotificationSettings(
    userId: string,
    settings: { notifPrice?: boolean; notifSignalFollow?: boolean; notifAiShield?: boolean },
  ) {
    const allowed: Record<string, boolean | undefined> = {};
    if (settings.notifPrice !== undefined) allowed['notifPrice'] = settings.notifPrice;
    if (settings.notifSignalFollow !== undefined) allowed['notifSignalFollow'] = settings.notifSignalFollow;
    if (settings.notifAiShield !== undefined) allowed['notifAiShield'] = settings.notifAiShield;

    const user = await this.userModel.findByIdAndUpdate(userId, allowed, { new: true });
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

  async useGoogleAvatar(userId: string): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const googlePicture = (user as any).googlePicture;
    if (!googlePicture) {
      throw new BadRequestException({
        translationKey: 'profile.avatar.noGoogle',
      });
    }
    return this.updateUser(userId, {
      avatar: googlePicture,
      avatarSource: 'google',
    } as Partial<User>);
  }

  async useTelegramAvatar(userId: string): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!user.telegramId) {
      throw new BadRequestException({
        translationKey: 'profile.avatar.noTelegram',
      });
    }
    const photoUrl = await this.fetchTelegramAvatarUrl(user.telegramId);
    if (!photoUrl) {
      throw new BadRequestException({
        translationKey: 'profile.avatar.telegramFetchFailed',
      });
    }
    return this.updateUser(userId, {
      avatar: photoUrl,
      avatarSource: 'telegram',
    } as Partial<User>);
  }

  verifyTelegramWidgetData(data: any, botToken: string): boolean {
    const { hash, ...fields } = data;

    const dataCheckArr: string[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) {
        dataCheckArr.push(`${key}=${value}`);
      }
    }
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = createHash('sha256').update(botToken).digest();
    const calculatedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return calculatedHash === hash;
  }

  async telegramWidgetLogin(data: any) {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      throw new BadRequestException('Telegram Bot token is not configured');
    }

    if (!this.verifyTelegramWidgetData(data, botToken)) {
      throw new BadRequestException('Invalid Telegram signature');
    }

    const telegramId = Number(data.id);
    let user = await this.userModel.findOne({ telegramId });

    const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ');

    if (!user) {
      if (data.username) {
        const escapedUsername = data.username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        user = await this.userModel.findOne({
          telegramUsername: { $regex: new RegExp(`^${escapedUsername}$`, 'i') },
        });
        if (user && (!user.telegramId || user.telegramId === telegramId)) {
          user.telegramId = telegramId;
          await user.save();
        } else {
          user = null;
        }
      }
    }

    if (!user) {
      const title = sanitizeUserTitle(data.first_name) || `u${String(telegramId).slice(-6)}`;
      user = await this.userModel.create({
        telegramId,
        name: fullName || `User ${telegramId}`,
        telegramUsername: data.username,
        avatar: data.photo_url,
        avatarSource: data.photo_url ? 'telegram' : 'bitbots',
        title,
      });
    } else {
      let updated = false;
      if (fullName && user.name !== fullName) {
        user.name = fullName;
        updated = true;
      }
      if (data.username && user.telegramUsername !== data.username) {
        user.telegramUsername = data.username;
        updated = true;
      }
      if (
        data.photo_url &&
        (!user.avatarSource || user.avatarSource === 'telegram') &&
        user.avatar !== data.photo_url
      ) {
        user.avatar = data.photo_url;
        user.avatarSource = 'telegram';
        updated = true;
      }
      if (updated) await user.save();
    }

    return {
      token: this.login(user),
      user,
    };
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

    const getSupportedLanguage = (langCode?: string): string => {
      if (!langCode) return 'fa';
      const cleanCode = langCode.split('-')[0].toLowerCase();
      const supported = ['en', 'fa', 'ar', 'tr'];
      return supported.includes(cleanCode) ? cleanCode : 'en';
    };

    if (!user) {
      // Try to find by username if available, though telegramId is safer
      if (telegramUser.username) {
        const escapedUsername = telegramUser.username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        user = await this.userModel.findOne({
          telegramUsername: { $regex: new RegExp(`^${escapedUsername}$`, 'i') },
        });
        if (user && (!user.telegramId || user.telegramId === telegramId)) {
          user.telegramId = telegramId;
          await user.save();
        } else {
          user = null;
        }
      }
    }

    if (!user) {
       // Create new user from Telegram data without phone number
       const title = sanitizeUserTitle(telegramUser.first_name) || `u${String(telegramId).slice(-6)}`;
       user = await this.userModel.create({
         telegramId: telegramId,
         name: telegramUser.first_name,
         telegramUsername: telegramUser.username,
         avatar: telegramUser.photo_url,
         avatarSource: telegramUser.photo_url ? 'telegram' : 'bitbots',
         title,
         language: getSupportedLanguage(telegramUser.language_code),
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
        if (
          telegramUser.photo_url &&
          (!user.avatarSource || user.avatarSource === 'telegram') &&
          user.avatar !== telegramUser.photo_url
        ) {
            user.avatar = telegramUser.photo_url;
            user.avatarSource = 'telegram';
            updated = true;
        }
        const targetLang = getSupportedLanguage(telegramUser.language_code);
        if ((!user.language || user.language === 'en') && targetLang !== 'en') {
            user.language = targetLang;
            updated = true;
        }
        if (updated) await user.save();
    }

    return {
      token: this.login(user),
      user: user
    };
  }

  async getBotUsername(): Promise<string> {
    if (this.cachedBotUsername) return this.cachedBotUsername;
    if (process.env.TELEGRAM_BOT_NAME) {
      this.cachedBotUsername = process.env.TELEGRAM_BOT_NAME;
      return this.cachedBotUsername;
    }
    const token = process.env.BOT_TOKEN;
    if (!token) {
      throw new BadRequestException('BOT_TOKEN is not configured');
    }
    try {
      const res = await this.http.get(`https://api.telegram.org/bot${token}/getMe`).toPromise();
      const username = res?.data?.result?.username;
      if (!username) {
        throw new BadRequestException('Failed to retrieve bot username from Telegram API');
      }
      this.cachedBotUsername = username;
      return username;
    } catch (e: any) {
      console.error('Failed to get bot username from Telegram:', e.message);
      throw new BadRequestException('Failed to get bot username from Telegram API');
    }
  }

  async telegramOidcLogin(code: string, redirectUri: string) {
    const clientId = process.env.TELEGRAM_OIDC_CLIENT_ID;
    const clientSecret = process.env.TELEGRAM_OIDC_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Telegram OIDC Client ID or Client Secret is not configured');
    }

    // Exchange authorization code for tokens
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', clientId);

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    let tokenResponse;
    try {
      const res = await this.http
        .post('https://oauth.telegram.org/token', params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authHeader}`,
          },
        })
        .toPromise();
      tokenResponse = res?.data;
    } catch (e: any) {
      console.error('Telegram OIDC token exchange failed:', e?.response?.data || e.message);
      throw new BadRequestException('Failed to exchange code for Telegram token');
    }

    const idToken = tokenResponse?.id_token;
    if (!idToken) {
      throw new BadRequestException('id_token is missing from token response');
    }

    // Decode JWT header to extract kid
    const decodedJwt = jwt.decode(idToken, { complete: true }) as any;
    if (!decodedJwt?.header?.kid) {
      throw new BadRequestException('Invalid ID token format: missing kid');
    }
    const kid = decodedJwt.header.kid;
    const alg = decodedJwt.header.alg;

    // Fetch Telegram JWKS public keys
    let keys;
    try {
      const jwksRes = await this.http.get('https://oauth.telegram.org/.well-known/jwks.json').toPromise();
      keys = jwksRes?.data?.keys || [];
    } catch (e: any) {
      console.error('Failed to fetch Telegram JWKS:', e.message);
      throw new BadRequestException('Failed to fetch Telegram JWKS');
    }

    const jwk = keys.find((key: any) => key.kid === kid);
    if (!jwk) {
      throw new BadRequestException(`Key with kid ${kid} not found in Telegram JWKS`);
    }

    // Import JWK and verify signature and claims
    let payload: any;
    try {
      const publicKey = createPublicKey({
        key: jwk,
        format: 'jwk',
      });
      payload = jwt.verify(idToken, publicKey, {
        algorithms: [alg],
        audience: clientId,
        issuer: 'https://oauth.telegram.org',
      }) as any;
    } catch (e: any) {
      console.error('Telegram OIDC ID token validation failed:', e.message);
      throw new BadRequestException('Invalid Telegram ID token signature');
    }

    if (!payload?.sub) {
      throw new BadRequestException('Invalid Telegram ID token: missing sub');
    }

    const telegramId = payload.id ? Number(payload.id) : Number(payload.sub);
    const fullName = payload.name;
    const username = payload.preferred_username;
    const photo_url = payload.picture;

    let user = await this.userModel.findOne({ telegramId });

    // Try matching by phone number if user not found by telegramId
    const rawPhone = payload.phone_number;
    let normalizedPhone: string | undefined;
    if (rawPhone) {
      const clean = rawPhone.replace(/\D/g, '');
      normalizedPhone = clean.startsWith('98') && clean.length === 12 ? '0' + clean.slice(2) : clean;
    }

    if (!user && normalizedPhone) {
      user = await this.userModel.findOne({ phone: normalizedPhone });
      if (user && (!user.telegramId || user.telegramId === telegramId)) {
        user.telegramId = telegramId;
        if (username) user.telegramUsername = username;
        await user.save();
      } else {
        user = null;
      }
    }

    if (!user && username) {
      const escapedUsername = username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      user = await this.userModel.findOne({
        telegramUsername: { $regex: new RegExp(`^${escapedUsername}$`, 'i') },
      });
      if (user && (!user.telegramId || user.telegramId === telegramId)) {
        user.telegramId = telegramId;
        await user.save();
      } else {
        user = null;
      }
    }

    if (!user) {
      const title = sanitizeUserTitle(fullName || username) || `u${String(telegramId).slice(-6)}`;
      user = await this.userModel.create({
        telegramId,
        phone: normalizedPhone,
        name: fullName || `User ${telegramId}`,
        telegramUsername: username,
        avatar: photo_url,
        avatarSource: photo_url ? 'telegram' : 'bitbots',
        title,
      });
    } else {
      let updated = false;
      if (fullName && user.name !== fullName) {
        user.name = fullName;
        updated = true;
      }
      if (username && user.telegramUsername !== username) {
        user.telegramUsername = username;
        updated = true;
      }
      if (normalizedPhone && !user.phone) {
        const existingPhoneUser = await this.userModel.findOne({ phone: normalizedPhone });
        if (!existingPhoneUser) {
          user.phone = normalizedPhone;
          updated = true;
        }
      }
      if (
        photo_url &&
        (!user.avatarSource || user.avatarSource === 'telegram') &&
        user.avatar !== photo_url
      ) {
        user.avatar = photo_url;
        user.avatarSource = 'telegram';
        updated = true;
      }
      if (updated) await user.save();
    }

    return {
      token: this.login(user),
      user,
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
      const firstName = payload.name ? payload.name.split(' ')[0] : '';
      const emailPrefix = payload.email ? payload.email.split('@')[0] : '';
      const title = sanitizeUserTitle(firstName || emailPrefix) || `u${googleId.slice(-6)}`;

      user = await this.userModel.create({
        googleId,
        email: payload.email ?? undefined,
        name: payload.name ?? undefined,
        avatar: payload.picture ?? undefined,
        googlePicture: payload.picture ?? undefined,
        avatarSource: payload.picture ? 'google' : 'bitbots',
        title,
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
      if (payload.picture != null) {
        if (
          (!user.avatarSource || user.avatarSource === 'google') &&
          user.avatar !== payload.picture
        ) {
          user.avatar = payload.picture;
          user.avatarSource = 'google';
          updated = true;
        }
        if ((user as any).googlePicture !== payload.picture) {
          (user as any).googlePicture = payload.picture;
          updated = true;
        }
      }
      if (updated) await user.save();
    }

    return {
      token: this.login(user),
      user,
    };
  }

  /**
   * Uses Google's tokeninfo endpoint to verify the ID token.
   */
  private async verifyGoogleTokenViaTokenInfo(
    idToken: string,
    clientId: string,
  ): Promise<{ sub: string; email?: string; name?: string; picture?: string } | null> {
    try {
      const res = await this.http
        .get<{ sub?: string; aud?: string; email?: string; name?: string; picture?: string }>(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
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

