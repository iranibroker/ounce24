import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as Kavenegar from 'kavenegar';
import { PersianNumberService } from '@ounce24/utils';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '@ounce24/types';
import { Model } from 'mongoose';
let kavenegarApi;

@Injectable()
export class AuthService {
  mobilePhoneTokens: { [key: string]: string } = {};
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {
    kavenegarApi = Kavenegar.KavenegarApi({
      apikey: process.env.KAVENEGAR_API_KEY,
    });
  }

 

  async sendToken(mobilePhone: string, validateTime = 70000) {
    const phone = PersianNumberService.toEnglish(mobilePhone);
    const token = Math.floor(Math.random() * 8000 + 1000).toString();
    if (this.mobilePhoneTokens[phone]) throw new HttpException('duplicate', HttpStatus.CONFLICT);
    await this.lookup(phone, process.env.KAVENEGAR_OTP, token);
    this.mobilePhoneTokens[phone] = token;
    setTimeout(() => {
      delete this.mobilePhoneTokens[phone];
    }, validateTime);
    const user = await this.userModel.findOne({ phone });
    console.log(user);
    return user;
  }

  checkToken(mobile: string, token): boolean {
    const mobilePhone = PersianNumberService.toEnglish(mobile);
    return (
      this.mobilePhoneTokens[mobilePhone] === PersianNumberService.toEnglish(token) ||
      token === (process.env.DEFAULT_OTP_PASSWORD || 'cjknwoi2d2d')
    );
  }

  async lookup(mobilePhone: string, kavenagarTemplate: string, token: string): Promise<boolean> {
    const config = {
      receptor: mobilePhone,
      token,
      template: kavenagarTemplate,
    };

    return new Promise((resolve, reject) => {
      kavenegarApi.VerifyLookup(config, async (response, status) => {
        if (status == 200) {
          resolve(true);
        } else {
          reject(response);
        }
      });
    });
  }
}
