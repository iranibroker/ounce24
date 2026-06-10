import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { z } from 'zod';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResponse<T> {
  data: T;
  model: string;
  usage: TokenUsage;
  latencyMs: number;
}

@Injectable()
export class AiClientService {
  private client: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Calls the OpenAI API and returns a structured response matching the provided Zod schema.
   */
  async createStructuredResponse<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodType<T>,
    model: 'gpt-4o' | 'gpt-4o-mini',
    options?: { temperature?: number }
  ): Promise<ChatResponse<T>> {
    const temperature = options?.temperature !== undefined ? options.temperature : 0.1;
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const latencyMs = Date.now() - startTime;
      const text = response.choices[0]?.message?.content || '{}';
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      const totalTokens = response.usage?.total_tokens || 0;

      // Parse JSON safely
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(text);
      } catch (e) {
        throw new Error(`Failed to parse response text as JSON: ${text}`);
      }

      // Validate parsed JSON against the provided Zod schema
      const validationResult = schema.safeParse(parsedJson);
      if (!validationResult.success) {
        throw new Error(
          `Validation against Zod schema failed: ${JSON.stringify(
            validationResult.error.format()
          )}. Raw response: ${text}`
        );
      }

      return {
        data: validationResult.data,
        model,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
        },
        latencyMs,
      };
    } catch (error) {
      console.error(`Error in AiClientService for model ${model}:`, error);
      throw error;
    }
  }
}
