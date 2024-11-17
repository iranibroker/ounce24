import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '@ounce24/types';
import { Model } from 'mongoose';
import { Action, Ctx, InjectBot, Update } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { AuthService } from '../auth/auth.service';
import { BaseBot, UserStateType } from './base-bot';

@Injectable()
@Update()
export class ConsultingBotService extends BaseBot {
  constructor(
    @InjectBot('main') private bot: Telegraf<Context>,
    @InjectModel(User.name) private userModel: Model<User>,
    private auth: AuthService
  ) {
    super(userModel, auth, bot);
  }

  onConsulting(@Ctx() ctx: Context) {
    ctx.reply(`این سرویس به شما کمک می‌کند تا با بررسی شرایط فعلی بازار، پوزیشن معاملاتی بهتری را برای نماد مورد نظر خود انتخاب کنید.

لطفاً موارد زیر را در یک پیام برای ما ارسال کنید:
-توضیحات کامل پوزیشنی که قصد دارید روی آن نماد فارکسی بگیرید.
-دلایل یا استراتژی‌های مورد نظر شما برای این پوزیشن (در صورت وجود).

تیم تحلیلی ما با بررسی بازار و تحلیل شرایط، به شما پیشنهاداتی ارائه خواهد داد تا بتوانید در راستای بهبود تصمیمات معاملاتی خود عمل کنید.

توجه:
این تحلیل تنها یک پیشنهاد مشاوره‌ای است و مسئولیت نهایی و ریسک‌های مرتبط با معاملات کاملاً بر عهده خود شماست. پیشنهادات ارائه‌شده صرفاً توصیه‌ای هستند و باید با در نظر گرفتن تمام جوانب و بررسی‌های دقیق شما انجام شود.
با آرزوی موفقیت برای شما در معاملات! 

/cancel
`);

    this.setState(ctx.from.id, { state: UserStateType.Consulting });
  }

  async sendUserMessage(ctx: Context) {
    if (process.env.CONSULTING_ADMIN_IDS) {
      const ids = process.env.CONSULTING_ADMIN_IDS.split(',');
      for (const admin of ids) {
        this.bot.telegram.forwardMessage(
          admin,
          ctx.chat.id,
          ctx.message.message_id
        );
      }
    }
    await ctx.sendChatAction('typing');
    await ctx.reply('پیام شما ارسال شد. منتظر پاسخ باشید...', {
      reply_markup: {
        inline_keyboard: [[{ text: 'بستن گفتگو', callback_data: 'start' }]],
      },
    });
  }

  sendResponseMessage(ctx: Context) {
    const replyTo = ctx.message['reply_to_message']?.['forward_from'];
    ctx.copyMessage(replyTo.id);
  }
}
