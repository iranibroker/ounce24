import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  fa: 'Persian (Farsi)',
  ar: 'Arabic',
  tr: 'Turkish',
};

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
    lang = 'fa',
    options?: { temperature?: number },
  ): Promise<{ text: string; totalTokens: number; model: string }> {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const targetLang = LANGUAGE_NAMES[lang] || 'Persian (Farsi)';
    const temperature = options?.temperature !== undefined ? options.temperature : 0.2;
    const response = await this.client.chat.completions.create({
      model,
      temperature,
      messages: [
        {
          role: 'system',
          content: `You are an expert, extremely bold, decisive, and authoritative financial analyst for Ounce24. 
Current Date: ${new Date().toDateString()}.
Always write the analysis in simple, clear, and direct ${targetLang}, avoiding fence-sitting or double-sided arguments. Be highly opinionated and direct.
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
    return { text: cleanedText, totalTokens, model };
  }
}
