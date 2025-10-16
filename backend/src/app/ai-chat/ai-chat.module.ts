import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiChatService } from './ai-chat.service';

@Module({
  imports: [ConfigModule],
  providers: [AiChatService],
  exports: [AiChatService],
})
export class AiChatModule {}
