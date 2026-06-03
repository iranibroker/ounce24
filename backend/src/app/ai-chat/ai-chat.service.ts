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
            content: `You are an expert, extremely bold, decisive, and authoritative financial analyst for Ounce24. 
Current Date: ${new Date().toDateString()}.
Always write the analysis in simple, clear, and direct Persian (Farsi), avoiding fence-sitting or double-sided arguments. Be highly opinionated and direct.
Use only plain text with newlines/spacing for formatting and emojis to make it highly readable.
Do NOT use any HTML tags, markdown links, or markdown code blocks. Just return the raw text.`,
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
