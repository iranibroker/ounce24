import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
const PROMPT_ID = 'pmpt_68c8f1e43d388196972aa9fb83407105048f2b7031cf1a02';
@Injectable()
export class AiChatService {
  private client: OpenAI;
  constructor(private configService: ConfigService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    this.client = new OpenAI({ apiKey });
  }

  async createConversation() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const conversation = await this.client.conversations.create({});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return conversation.id;
  }

  async createResponse(
    message: string,
    conversationId?: string,
  ): Promise<{ text: string, totalTokens: number }> {
    const abortController = new AbortController();
    try {
      console.log('💬', message);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const response = await this.client.responses.create({
        input: message,
        conversation: conversationId,
        prompt: {
          id: PROMPT_ID,
          variables: {
            date: new Date().toDateString(),
          },
        },
      });

      const cleanedText = response.output_text;
      return { text: cleanedText, totalTokens: response.usage.total_tokens };
    } catch (error) {
      if (abortController.signal.aborted) {
        console.log('AI request was aborted');
        throw new Error('Request was cancelled');
      }
      console.warn(
        'Structured output failed, falling back to text generation:',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error,
      );
      throw error;
    }
  }
}
