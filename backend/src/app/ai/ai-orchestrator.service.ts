import { Injectable, Logger } from '@nestjs/common';
import {
  Signal,
  SignalType,
  TradingStyle,
  RiskTolerance,
  AiEvaluationType,
  AiEvaluationOutcome,
} from '@ounce24/types';
import { AiClientService, ChatResponse } from './ai-client.service';
import { ContextBuilderService, MarketStateContext, NewsContext } from './context-builder.service';
import { GuardrailsService } from './guardrails.service';
import { EvaluationService } from './evaluation.service';
import { z } from 'zod';

// Zod schemas for strict output validation
const SignalAnalysisSchema = z.object({
  successProbability: z.number().min(0).max(100),
  analysis: z.string(),
});

const SignalGenerationSchema = z.object({
  type: z.string().nullable().transform(val => {
    if (!val || val.toLowerCase() === 'null') return null;
    const upper = val.toUpperCase();
    if (upper === 'BUY') return SignalType.Buy;
    if (upper === 'SELL') return SignalType.Sell;
    return null;
  }).pipe(z.nativeEnum(SignalType).nullable()),
  entryPrice: z.number().nullable(),
  takeProfit: z.number().nullable(),
  stopLoss: z.number().nullable(),
  instantEntry: z.boolean(),
  successProbability: z.number().min(0).max(100),
  generationAnalysis: z.string(),
});

const CopilotRecommendationSchema = z.object({
  recommendation: z.enum(['risk_free', 'trailing_sl', 'extend_tp', 'early_exit', 'cancel', 'none']),
  price: z.number(),
  messageFa: z.string(),
  messageEn: z.string(),
  messageAr: z.string(),
  messageTr: z.string(),
});

export interface SignalAnalysisType {
  successProbability: number;
  analysis: string;
}

export interface SignalGenerationType {
  type: SignalType | null;
  entryPrice: number | null;
  takeProfit: number | null;
  stopLoss: number | null;
  instantEntry: boolean;
  successProbability: number;
  generationAnalysis: string;
}

export interface CopilotRecommendationType {
  recommendation: 'risk_free' | 'trailing_sl' | 'extend_tp' | 'early_exit' | 'cancel' | 'none';
  price: number;
  messageFa: string;
  messageEn: string;
  messageAr: string;
  messageTr: string;
}

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  constructor(
    private readonly aiClient: AiClientService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly guardrails: GuardrailsService,
    private readonly evaluation: EvaluationService
  ) {}

  /**
   * Refactored Signal Analysis flow.
   */
  async analyzeSignal(
    signal: Signal,
    userLang: string,
    currentPrice: number,
    marketState: MarketStateContext,
    dxyPrice?: number | null,
    us10yYield?: number | null,
    news?: NewsContext,
    overrides?: { tradingStyle?: TradingStyle; riskTolerance?: RiskTolerance }
  ): Promise<{ data: SignalAnalysisType; latencyMs: number; totalTokens: number; model: string }> {
    this.logger.log(`Orchestrator: Running signal analysis...`);

    const style = overrides?.tradingStyle || TradingStyle.Day;
    const risk = overrides?.riskTolerance || RiskTolerance.Moderate;

    const signalType = signal.type;
    const isSell = signalType === SignalType.Sell;
    const profit = isSell ? signal.minPrice : signal.maxPrice;
    const loss = isSell ? signal.maxPrice : signal.minPrice;

    // Calculate metrics
    const targetDistance = Math.abs(profit - signal.entryPrice);
    const slDistance = Math.abs(signal.entryPrice - loss);
    const rrRatio = slDistance > 0 ? targetDistance / slDistance : 0;

    // Context preparation
    const marketContext = this.contextBuilder.buildMarketMetricsContext(
      currentPrice,
      marketState,
      dxyPrice,
      us10yYield,
      news
    );
    const styleContext = this.contextBuilder.buildStyleInstructionsContext(style, risk);
    const langName = this.contextBuilder.getLanguageName(userLang);

    const systemPrompt = `You are an expert Gold (XAUUSD) technical analyst AI for Ounce24.
Evaluate signals objectively. Return ONLY a valid JSON object.
Do NOT use markdown format, backticks, or any explanations outside of JSON.`;

    const analysisRules = this.contextBuilder.buildDynamicAnalysisRules(
      risk,
      marketState.atr1h,
      langName,
    );

    const userPrompt = `
Analyze the following trading setup:
- Signal Direction: ${signalType}
- Entry Price: $${signal.entryPrice.toFixed(2)}
- Take Profit (TP): $${profit.toFixed(2)}
- Stop Loss (SL): $${loss.toFixed(2)}
- Current Market Price: $${currentPrice.toFixed(2)}
- Stop Loss Distance: $${slDistance.toFixed(2)} (${(slDistance / marketState.atr1h).toFixed(2)}x 1h ATR)
- Target Distance: $${targetDistance.toFixed(2)} (${(targetDistance / marketState.atr1h).toFixed(2)}x 1h ATR)
- Risk-Reward (R:R) Ratio: ${rrRatio.toFixed(2)}

${marketContext}
${styleContext}

${analysisRules}

JSON Schema format to return:
{
  "successProbability": number,
  "analysis": "Brief 1-line summary followed by 1-2 paragraphs of technical reasoning in ${langName}."
}
`;

    const response = await this.aiClient.createStructuredResponse(
      systemPrompt,
      userPrompt,
      SignalAnalysisSchema,
      'gpt-4o-mini',
      { temperature: 0.1 }
    );

    // Log telemetry
    await this.evaluation.logEvaluation({
      signalId: signal._id || (signal as any).id,
      type: AiEvaluationType.Analyze,
      prompt: userPrompt,
      response: response.data,
      model: response.model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.latencyMs,
      predictedProbability: response.data.successProbability,
    });

    return {
      data: response.data as SignalAnalysisType,
      latencyMs: response.latencyMs,
      totalTokens: response.usage.totalTokens,
      model: response.model,
    };
  }

  /**
   * Refactored Signal Generation flow.
   */
  async generateSignal(
    userLang: string,
    currentPrice: number,
    marketState: MarketStateContext,
    dxyPrice?: number | null,
    us10yYield?: number | null,
    news?: NewsContext,
    overrides?: { tradingStyle?: TradingStyle; riskTolerance?: RiskTolerance }
  ): Promise<{ data: SignalGenerationType; latencyMs: number; totalTokens: number; model: string; prompt?: string }> {
    this.logger.log(`Orchestrator: Running signal generation...`);

    const style = overrides?.tradingStyle || TradingStyle.Day;
    const risk = overrides?.riskTolerance || RiskTolerance.Moderate;

    const marketContext = this.contextBuilder.buildMarketMetricsContext(
      currentPrice,
      marketState,
      dxyPrice,
      us10yYield,
      news
    );
    const styleContext = this.contextBuilder.buildStyleInstructionsContext(style, risk);
    const langName = this.contextBuilder.getLanguageName(userLang);

    const systemPrompt = `You are a Gold (XAUUSD) quantitative trading assistant for Ounce24.
Analyze current market state and generate the best possible signal (or null if no setup is high-probability).
Return ONLY a valid JSON object matching the requested schema. Do NOT return markdown or backticks.`;

    const coreRules = this.contextBuilder.buildDynamicCoreRules(
      style,
      risk,
      marketState.atr5m,
      marketState.atr1h,
      langName,
    );

    const userPrompt = `
Generate a trading signal based on the current market data:

Market State:
${marketState.semanticText}

${marketContext}
${styleContext}

${coreRules}

JSON Schema format to return:
{
  "type": "buy" | "sell" | null,
  "entryPrice": number | null,
  "takeProfit": number | null,
  "stopLoss": number | null,
  "instantEntry": boolean,
  "successProbability": number,
  "generationAnalysis": "Brief 1-2 paragraph reasoning in ${langName} explaining the setup, or explaining why no high-probability setup could be found."
}
`;

    // Generation is routed to the high-quality gpt-4o model for maximum precision
    const response = await this.aiClient.createStructuredResponse(
      systemPrompt,
      userPrompt,
      SignalGenerationSchema,
      'gpt-4o',
      { temperature: 0.1 }
    );

    // Apply logical guardrails locally
    const validatedData: SignalGenerationType = { ...response.data as any };
    if (validatedData.type) {
      const guardResult = this.guardrails.validateSignal({
        type: validatedData.type,
        entryPrice: validatedData.entryPrice || 0,
        takeProfit: validatedData.takeProfit || 0,
        stopLoss: validatedData.stopLoss || 0,
        instantEntry: validatedData.instantEntry,
        isVolatile: marketState.isVolatile,
        atr5m: marketState.atr5m,
        atr1h: marketState.atr1h,
        currentPrice: currentPrice,
        tradingStyle: style,
        riskTolerance: risk,
      });

      if (!guardResult.isValid) {
        this.logger.warn(`Signal rejected by local Guardrails: ${guardResult.reason}`);
        validatedData.type = null;
        validatedData.entryPrice = null;
        validatedData.takeProfit = null;
        validatedData.stopLoss = null;
        validatedData.generationAnalysis += `\n\n[Rejected by System Guardrails: ${guardResult.reason}]`;
      }
    }

    // Log telemetry
    await this.evaluation.logEvaluation({
      type: AiEvaluationType.Generate,
      prompt: userPrompt,
      response: validatedData,
      model: response.model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.latencyMs,
      predictedProbability: validatedData.successProbability,
    });

    return {
      data: validatedData,
      latencyMs: response.latencyMs,
      totalTokens: response.usage.totalTokens,
      model: response.model,
      prompt: userPrompt,
    };
  }

  /**
   * Refactored Smart Shield Copilot evaluation.
   */
  async evaluateCopilot(
    signal: Signal,
    currentPrice: number,
    marketState: MarketStateContext,
    overrides?: { tradingStyle?: TradingStyle; riskTolerance?: RiskTolerance }
  ): Promise<{ data: CopilotRecommendationType; latencyMs: number; totalTokens: number; model: string }> {
    this.logger.log(`Orchestrator: Running Copilot Smart Shield evaluation for signal ${signal._id}...`);

    const style = overrides?.tradingStyle || TradingStyle.Day;
    const risk = overrides?.riskTolerance || RiskTolerance.Moderate;

    const isSell = signal.type === SignalType.Sell;
    const entryPrice = signal.entryPrice;
    const tp = isSell ? signal.minPrice : signal.maxPrice;
    const sl = isSell ? signal.maxPrice : signal.minPrice;
    const alreadyRecommendedRiskFree = signal.aiRecommendations?.some((rec) => rec.type === 'risk_free') || signal.riskFree;

    const marketContext = this.contextBuilder.buildMarketMetricsContext(
      currentPrice,
      marketState
    );
    const styleContext = this.contextBuilder.buildStyleInstructionsContext(style, risk);

    const systemPrompt = `You are a Smart Shield AI Guard for Ounce24.
Evaluate active or pending trading setups and return recommendations.
Return ONLY a valid JSON object. Do NOT return markdown or backticks.`;

    const userPrompt = `
Evaluate the current status of the following Gold signal:
- Direction: ${signal.type}
- Status: ${signal.status}
- Entry Price: $${entryPrice.toFixed(2)}
- Current Price: $${currentPrice.toFixed(2)}
- Take Profit (TP): $${tp.toFixed(2)}
- Stop Loss (SL): $${sl.toFixed(2)}
- Is Risk-Free: ${alreadyRecommendedRiskFree ? 'YES' : 'NO'}

Market State:
${marketState.semanticText}

${marketContext}
${styleContext}

CORE MANAGEMENT RULES:
1. Pick ONE recommendation:
   - For ACTIVE signals: "risk_free" (only if current profit >= 1.5x ATR and not already done), "trailing_sl" (lock profit), "extend_tp" (strong momentum), "early_exit" (clear reversal), "none".
   - For PENDING signals: "cancel" (setup invalidated), "none".
2. Support & Resistance levels:
   - For BUY: support levels act as floors for SL (protective features), resistance levels act as obstacles (negative features).
   - For SELL: resistance levels act as ceilings for SL (protective features), support levels act as obstacles (negative features).
3. Recommend "early_exit" if price breaks critical trend levels in the opposite direction, or if a major opposing S/R zone has rejected price.
4. Recommend "cancel" on pending limits if price reaches TP without triggering entry, or breaks past SL, or becomes unreachable (> 3.0x ATR).
5. Translate/write the explanation message for all four requested languages: Farsi/Persian (messageFa), English (messageEn), Arabic (messageAr), and Turkish (messageTr).

JSON Schema format to return:
{
  "recommendation": "risk_free" | "trailing_sl" | "extend_tp" | "early_exit" | "cancel" | "none",
  "price": number,
  "messageFa": "Explanation in Persian",
  "messageEn": "Explanation in English",
  "messageAr": "Explanation in Arabic",
  "messageTr": "Explanation in Turkish"
}
`;

    const response = await this.aiClient.createStructuredResponse(
      systemPrompt,
      userPrompt,
      CopilotRecommendationSchema,
      'gpt-4o-mini',
      { temperature: 0.1 }
    );

    // Log telemetry
    await this.evaluation.logEvaluation({
      signalId: signal._id || (signal as any).id,
      type: AiEvaluationType.Copilot,
      prompt: userPrompt,
      response: response.data,
      model: response.model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      latencyMs: response.latencyMs,
    });

    return {
      data: response.data as CopilotRecommendationType,
      latencyMs: response.latencyMs,
      totalTokens: response.usage.totalTokens,
      model: response.model,
    };
  }
}
