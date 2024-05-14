import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { SignalsModule } from './signals/signals.module';
import { ConfigModule } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { BotModule } from './bot/bot.module';
import { SchemasModule } from './schemas/schemas.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGO_URI),
    TelegrafModule.forRoot({
      token: process.env.BOT_TOKEN,
    }),
    SignalsModule,
    BotModule,
    SchemasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
