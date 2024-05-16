import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { SignalsModule } from './signals/signals.module';
import { ConfigModule } from '@nestjs/config';
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
    TelegrafModule.forRoot({
      token: process.env.BOT_TOKEN,
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
