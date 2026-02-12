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
    ctx.reply(`This service helps you choose better trading positions based on current market conditions.

Please send us in one message:
- Full description of the position you plan to take.
- Your reasons or strategy for this position (if any).

Our team will review the market and send you suggestions to improve your trading decisions.

Note:
This is advisory only. Final responsibility and trading risk are yours. Suggestions are recommendations and should be considered with your own analysis.
Good luck with your trades!

/cancel
`);

    this.setState(ctx.from.id, { state: UserStateType.Consulting });
  }

  async sendUserMessage(ctx: Context) {
    if (process.env.CONSULTING_ADMIN_IDS) {
      const ids = process.env.CONSULTING_ADMIN_IDS.split(',');
      for (const admin of ids) {
        await this.bot.telegram.forwardMessage(
          admin,
          ctx.chat.id,
          ctx.message.message_id
        );
        this.bot.telegram.sendMessage(admin, `${ctx.message.from.id}`);
      }
    }
    await ctx.sendChatAction('typing');
    await ctx.reply('Your message was sent. Waiting for reply...', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Close chat', callback_data: 'start' }]],
      },
    });
  }

  sendResponseMessage(ctx: Context) {
    const replyTo = ctx.message['reply_to_message']['text'];
    ctx.copyMessage(replyTo);
  }
}
