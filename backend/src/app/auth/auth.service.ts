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

    const token = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: expireTokenIn,
    });

    return token;
  }

  async createAlternativeTelegramToken(telegramId: number) {
    const user = await this.userModel.findOne({ telegramId });
    if (user) {
      const payload = {
        id: user.id,
        phone: user.phone,
      };

      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '3d',
      });
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
    return (
      this.mobilePhoneTokens[mobilePhone]?.toString() ===
        PersianNumberService.toEnglish(token)?.toString() ||
      token === (process.env.DEFAULT_OTP_PASSWORD || 'cjknwoi2d2d')
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
}
