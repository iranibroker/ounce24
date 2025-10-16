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
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UsersModule } from './users/users.module';
import { PodcastModule } from './podcast/podcast.module';
import { HttpModule } from '@nestjs/axios';
import { AiChatModule } from './ai-chat/ai-chat.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
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
    HttpModule,
    ...PublishBotsModules,
    SchemasModule,
    AuthModule,
    SignalsModule,
    BotModule,
    OuncePriceModule,
    UsersModule,
    PodcastModule,
    AiChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
