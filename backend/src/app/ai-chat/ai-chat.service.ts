import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
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
    return 'direct-api-session';
  }

  async createResponse(
    message: string,
  ): Promise<{ text: string; totalTokens: number }> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert, bold, and completely honest financial analyst for Ounce24. 
Current Date: ${new Date().toDateString()}.
Always write the analysis in simple and clear Persian (Farsi).
Use HTML tags like <b>, <ul>, <li>, <br> for formatting. Do not use markdown syntax or markdown links.`,
          },
          {
            role: 'user',
            content: message,
          },
        ],
      });

      const text = response.choices[0]?.message?.content || '';
      const totalTokens = response.usage?.total_tokens || 0;

      const cleanedText = text.replace(
        /\[(.*?)\]\((.*?)\)/g,
        '<a href="$2">$1</a>',
      );
      return { text: cleanedText, totalTokens };
    } catch (error) {
      throw error;
    }
  }
}
