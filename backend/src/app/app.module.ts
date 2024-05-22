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

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB_NAME,
    }),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      botName: 'main',
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('BOT_TOKEN'),
      }),
      inject: [ConfigService],
    }),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      botName: 'publish1',
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('PUBLISHER1_BOT_TOKEN'),
      }),
      inject: [ConfigService],
    }),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      botName: 'publish2',
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('PUBLISHER2_BOT_TOKEN'),
      }),
      inject: [ConfigService],
    }),
    SignalsModule,
    BotModule,
    SchemasModule,
    OuncePriceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
