import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';

const botKeys = ['PUBLISHER1_BOT_TOKEN', 'PUBLISHER2_BOT_TOKEN'];

export const PublishBotsModules = botKeys.map((k, index) =>
  TelegrafModule.forRootAsync({
    imports: [ConfigModule],
    botName: 'publish' + (index + 1),
    useFactory: (configService: ConfigService) => ({
      token: configService.get<string>(k),
    }),
    inject: [ConfigService],
  })
);