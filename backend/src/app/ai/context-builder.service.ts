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
