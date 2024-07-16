import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { SignalsModule } from './signals/signals.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { BotModule } from './bot/bot.module';
import { SchemasModule } from './schemas/schemas.module';
import { OuncePriceModule } from './ounce-price/ounce-price.module';
import { PublishBotsModules } from './configs/publisher-bots.config';
import { AuthModule } from './auth/auth.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB_NAME,
    }),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      botName: 'ounce',
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('OUNCE_PUBLISHER_BOT'),
      }),
      inject: [ConfigService],
    }),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      botName: 'main',
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('BOT_TOKEN'),
      }),
      inject: [ConfigService],
    }),
    ...PublishBotsModules,
    AuthModule,
    SignalsModule,
    BotModule,
    SchemasModule,
    OuncePriceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
