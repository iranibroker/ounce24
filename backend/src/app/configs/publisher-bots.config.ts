import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';

export const BOT_KEYS = ['PUBLISHER1_BOT', 'PUBLISHER2_BOT'];

export const PublishBotsModules = BOT_KEYS.map((k, index) =>
  TelegrafModule.forRootAsync({
    imports: [ConfigModule],
    botName: k,
    useFactory: (configService: ConfigService) => ({
      token: configService.get<string>(k),
    }),
    inject: [ConfigService],
  })
);