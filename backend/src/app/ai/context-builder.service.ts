import { Injectable } from '@nestjs/common';
import { TradingStyle, RiskTolerance } from '@ounce24/types';

export interface MarketStateContext {
  semanticText: string;
  tradingSession?: string;
  isVolatile?: boolean;
  atr5m: number;
  atr1h: number;
  adr14?: number;
}

export interface NewsContext {
  near: boolean;
  eventName?: string;
  timeDiffMinutes?: number;
}

@Injectable()
export class ContextBuilderService {
  /**
   * Generates the mathematical and correlation context block in English.
   */
  buildMarketMetricsContext(
    currentPrice: number,
    marketState: MarketStateContext,
    dxyPrice?: number | null,
    us10yYield?: number | null,
    news?: NewsContext
  ): string {
    const isVolatile = marketState.isVolatile ?? false;
    const tradingSession = marketState.tradingSession ?? 'Asian';
    const adr14 = marketState.adr14 ?? 4.0;

    let context = `[MATHEMATICAL, ECONOMIC & CORRELATION METRICS]\n`;
    context += `- Current XAUUSD Gold Price: $${currentPrice.toFixed(2)}\n`;
    context += `- Volatility State: ${isVolatile ? 'HIGH VOLATILITY (Limit orders highly recommended)' : 'NORMAL VOLATILITY'}\n`;
    context += `- Current Trading Session: ${tradingSession}\n`;
    context += `- 5-minute ATR (Short-term noise range): $${marketState.atr5m.toFixed(2)}\n`;
    context += `- 1-hour ATR (Intraday momentum range): $${marketState.atr1h.toFixed(2)}\n`;
    context += `- 14-day ADR (Average Daily Range): $${adr14.toFixed(2)}\n`;

    if (dxyPrice !== undefined && dxyPrice !== null) {
      context += `- US Dollar Index (DXY) price: ${dxyPrice.toFixed(2)} (Gold has strong negative correlation with DXY)\n`;
    }
    if (us10yYield !== undefined && us10yYield !== null) {
      context += `- US 10-Year Bond Yield (US10Y) yield: ${us10yYield.toFixed(2)}% (Gold has strong negative correlation with US10Y yields)\n`;
    }
    if (news?.near) {
      context += `- [CRITICAL VOLATILITY WARNING]: High-Impact USD Economic Calendar Event "${news.eventName}" is scheduled in ${news.timeDiffMinutes} minutes. Expect extreme volatility, rapid spreads widening, slippage, and high-velocity breakouts.\n`;
    }

    return context;
  }

  /**
   * Generates risk and style instructions in English.
   */
  buildStyleInstructionsContext(style: TradingStyle, risk: RiskTolerance): string {
    let instructions = `[STYLE & RISK PROFILE SETTINGS]\n`;

    if (style === TradingStyle.Scalp) {
      instructions += `- Trading Style: SCALPING (Very short-term trading). Focus heavily on the 5-minute and 15-minute timeframes. Use the 5m and 15m SMA20/SMA50 to determine momentum. For BUY setups, the entry price should be above 5m/15m SMAs or at a key support/OB/FVG. For SELL setups, the entry price should be below 5m/15m SMAs or at a key resistance/OB/FVG. Check short-term Price Action (candle rejections or breakout candles) at the 15m support/resistance levels. Ignore 1h/4h structures except as minor background direction. Suggest tighter stop loss levels (e.g. 1.0x ATR) and closer take profit levels.\n`;
    } else if (style === TradingStyle.Swing) {
      instructions += `- Trading Style: SWING TRADING (Medium to long-term trading). Focus on the 1-hour and 4-hour horizontal S/R structures. Completely ignore 5-minute and 15-minute noise. Suggest wider stop losses and larger take profit targets (at least 2.0x to 3.0x risk move) to allow the trade room to develop.\n`;
    } else {
      instructions += `- Trading Style: DAY TRADING (Intraday trading). Look to enter and exit within the day. Balance 15m momentum (using 15m SMA20/50 alignment) with 1h structure (using 1h SMA20/50 and horizontal S/R). Ensure entry/exit targets are not blocked by key short-term (15m) or medium-term (1h) levels. Price action rejections at 15m or 1h support/resistance are critical.\n`;
    }

    if (risk === RiskTolerance.Conservative) {
      instructions += `- Risk Tolerance: CONSERVATIVE (Low Risk). You must strictly follow the dominant trend direction (BUY when dominant trend is BULLISH, SELL when dominant trend is BEARISH). Reject any trade if there is a major horizontal barrier blocking the path to the TP. Risk-Reward ratio must be at least 2.0.\n`;
    } else if (risk === RiskTolerance.Aggressive) {
      instructions += `- Risk Tolerance: AGGRESSIVE (High Risk). You are allowed to suggest counter-trend breakout setups if momentum (RSI) is extremely strong in that direction. The Risk-Reward ratio can be as low as 1.2 if the momentum supports a quick target touch.\n`;
    } else {
      instructions += `- Risk Tolerance: MODERATE. Standard risk management rules apply (Risk-Reward ratio between 1.5 and 3.0).\n`;
    }

    return instructions;
  }

  /**
   * Generates dynamic Core Rules for signal generation/analysis based on style & risk.
   * This eliminates contradictions between Style instructions and hardcoded Core Rules.
   */
  buildDynamicCoreRules(
    style: TradingStyle,
    risk: RiskTolerance,
    atr5m: number,
    atr1h: number,
    langName: string,
  ): string {
    // Dynamic success probability threshold
    const threshold = risk === RiskTolerance.Conservative ? 75
      : risk === RiskTolerance.Aggressive ? 60
      : 70;

    // Dynamic minimum R:R ratio
    const minRR = risk === RiskTolerance.Conservative ? 2.0
      : risk === RiskTolerance.Aggressive ? 1.2
      : 1.5;

    // Dynamic target distance range (ATR multipliers)
    const [minTarget, maxTarget] = style === TradingStyle.Scalp ? [0.8, 2.5]
      : style === TradingStyle.Swing ? [2.5, 8.0]
      : [1.5, 5.0];

    // Trend timeframe reference — resolves "Ignore 1h/4h" vs "Trend 20%" contradiction
    const trendTimeframe = style === TradingStyle.Scalp
      ? '5m and 15m timeframes ONLY (ignore 1h/4h for trend scoring)'
      : style === TradingStyle.Swing
      ? '1h and 4h timeframes (ignore 5m/15m noise for trend scoring)'
      : '15m and 1h timeframes (use 4h as directional bias only)';

    let rules = `CORE SCIENTIFIC & TECHNICAL GENERATION RULES:\n`;
    rules += `1. Calculate the success probability based on: Trend alignment (20% — derived from ${trendTimeframe}), Correlation confluence (5%), SMC & OBs (30%), R:R & Target feasibility (20%), Momentum indicators (15%), Session/News timing (10%).\n`;
    rules += `2. If success probability is below ${threshold}%, do NOT generate a trade. Set the "type" field to null.\n`;
    rules += `3. For BUY setups: entry price must be equal to current price (if instant entry) or below current price (if limit entry). Stop loss must be below entry. Take profit must be above entry.\n`;
    rules += `4. For SELL setups: entry price must be equal to current price (if instant entry) or above current price (if limit entry). Stop loss must be above entry. Take profit must be below entry.\n`;
    rules += `5. If volatility is HIGH, you MUST set instantEntry = false (limit order only).\n`;
    rules += `6. Target distance must be at least ${minTarget}x ATR and no more than ${maxTarget}x ATR. Minimum R:R ratio is ${minRR}.\n`;
    rules += `7. Write the "generationAnalysis" text directly in ${langName}.\n`;

    return rules;
  }

  /**
   * Generates dynamic Core Rules for signal analysis (evaluate existing signal).
   */
  buildDynamicAnalysisRules(
    risk: RiskTolerance,
    atr1h: number,
    langName: string,
  ): string {
    let rules = `CORE EVALUATION RULES (MUST FOLLOW STRICTLY):\n`;
    rules += `1. Rate Success Probability out of 100 based on Trend Alignment (20%), Correlation confluence (5%), S/R structural blocks (30%), R:R limits (20%), Momentum indicators (15%), and Session/News timings (10%).\n`;
    rules += `2. For SELL signals, support levels below entry Price block TP, resistance levels above are Protective Stop Loss floors.\n`;
    rules += `3. For BUY signals, resistance levels above entry Price block TP, support levels below are Protective Stop Loss floors.\n`;
    rules += `4. Limit Order Entry Distance penalty: If this is a pending limit order and the Entry Price is extremely far from the Current Market Price (more than 4.0x 1-hour ATR, i.e., $${(4 * (atr1h || 4.0)).toFixed(2)}), you MUST penalize the success probability heavily (maximum score of 40%) because it is highly unrealistic to trigger.\n`;
    rules += `5. Narrow Stop Loss penalty: Gold has natural price noise. If the Stop Loss distance is narrower than 0.8x 1-hour ATR (i.e., less than $${(0.8 * (atr1h || 4.0)).toFixed(2)}), you MUST penalize the success probability severely (maximum score of 30%), regardless of how high the Risk-to-Reward ratio is, because it is extremely prone to being stopped out by standard market noise before any development.\n`;
    rules += `6. The response explanation must be written in the user's selected language: ${langName}. Make it a brief summary of 1-2 technical paragraphs.\n`;
    rules += `7. Absolute maximum success probability for an active/pending signal is 95% due to default market uncertainty.\n`;

    return rules;
  }

  /**
   * Translates language code to human readable name.
   */
  getLanguageName(lang: string): string {
    const map: Record<string, string> = {
      en: 'English',
      fa: 'Persian (Farsi)',
      ar: 'Arabic',
      tr: 'Turkish',
    };
    return map[lang] || 'Persian (Farsi)';
  }
}
