import { Injectable } from '@nestjs/common';
import { SignalType, TradingStyle, RiskTolerance } from '@ounce24/types';

export interface GuardrailInput {
  type: SignalType;
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  instantEntry: boolean;
  isVolatile: boolean;
  atr5m: number;
  atr1h: number;
  currentPrice: number;
  tradingStyle?: TradingStyle;
  riskTolerance?: RiskTolerance;
  successProbability: number; // Added to enable AI override bypass
}

export interface GuardrailResult {
  isValid: boolean;
  reason?: string;
}

@Injectable()
export class GuardrailsService {
  /**
   * Validates generated signals against technical, risk, and logical criteria.
   * Now style/risk-aware: thresholds adjust based on tradingStyle and riskTolerance.
   * Supports AI Override: soft guidelines are bypassed if successProbability >= 80%.
   */
  validateSignal(input: GuardrailInput): GuardrailResult {
    const {
      type, entryPrice, takeProfit, stopLoss, instantEntry,
      isVolatile, atr5m, atr1h, currentPrice,
      tradingStyle, riskTolerance, successProbability,
    } = input;

    const style = tradingStyle || TradingStyle.Day;
    const risk = riskTolerance || RiskTolerance.Moderate;

    // 1. Check basic mathematical sanity (Catastrophic Safeguard)
    if (entryPrice <= 0 || takeProfit <= 0 || stopLoss <= 0 || currentPrice <= 0) {
      return { isValid: false, reason: 'Prices must be greater than zero.' };
    }

    const isBuy = type === SignalType.Buy;
    const slDistance = Math.abs(entryPrice - stopLoss);
    const tpDistance = Math.abs(takeProfit - entryPrice);

    // 2. Validate orientation of entry, TP, and SL (Catastrophic Safeguard)
    if (isBuy) {
      if (takeProfit <= entryPrice) {
        return { isValid: false, reason: `For BUY signals, Take Profit ($${takeProfit}) must be strictly greater than Entry Price ($${entryPrice}).` };
      }
      if (stopLoss >= entryPrice) {
        return { isValid: false, reason: `For BUY signals, Stop Loss ($${stopLoss}) must be strictly less than Entry Price ($${entryPrice}).` };
      }
    } else {
      // Sell
      if (takeProfit >= entryPrice) {
        return { isValid: false, reason: `For SELL signals, Take Profit ($${takeProfit}) must be strictly less than Entry Price ($${entryPrice}).` };
      }
      if (stopLoss <= entryPrice) {
        return { isValid: false, reason: `For SELL signals, Stop Loss ($${stopLoss}) must be strictly greater than Entry Price ($${entryPrice}).` };
      }
    }

    // 3. Volatility restriction (No Instant Entry during High Volatility) - Soft limit (Bypassed if high confidence AI setup)
    if (isVolatile && instantEntry && successProbability < 80) {
      return { isValid: false, reason: 'Instant entries are prohibited during high volatility states.' };
    }

    // 4. Limit Order Entry Distance sanity check - Soft limit (Bypassed if high confidence AI sethup)
    if (!instantEntry && successProbability < 80) {
      const entryDistance = Math.abs(entryPrice - currentPrice);
      const maxEntryDistance = 4.0 * (atr1h || 4.0);
      if (entryDistance > maxEntryDistance) {
        return { isValid: false, reason: `Limit Entry Price ($${entryPrice.toFixed(2)}) is too far from current price ($${currentPrice.toFixed(2)}). Distance is $${entryDistance.toFixed(2)} (max allowed is $${maxEntryDistance.toFixed(2)}).` };
      }
    }

    // 5. Stop Loss distance sanity — Dynamic based on tradingStyle - Soft limit (Bypassed if high confidence AI setup)
    if (successProbability < 80) {
      const slAtrFactor = style === TradingStyle.Scalp ? 0.5
        : style === TradingStyle.Swing ? 1.0
        : 0.8;
      const atr = style === TradingStyle.Scalp ? (atr5m || 1.0) : (atr1h || 2.0);
      const minSlAllowed = Math.max(1.5, slAtrFactor * atr);
      if (slDistance < minSlAllowed) {
        return { isValid: false, reason: `Stop Loss distance ($${slDistance.toFixed(2)}) is too narrow. Minimum required is $${minSlAllowed.toFixed(2)} (${slAtrFactor}x ${style === TradingStyle.Scalp ? '5m' : '1h'} ATR for ${style} style).` };
      }
    }

    // 6. Risk-Reward Ratio (R:R) sanity check
    const rr = slDistance > 0 ? tpDistance / slDistance : 0;
    
    // Absolute catastrophic constraint: R:R must be strictly greater than 1.0 (Reward must exceed Risk)
    if (rr <= 1.0) {
      return { isValid: false, reason: `Risk-to-Reward ratio (${rr.toFixed(2)}) is catastrophic. R:R must be strictly greater than 1.0.` };
    }

    // Standard advisory R:R check (Bypassed if high confidence AI setup)
    const minRR = risk === RiskTolerance.Conservative ? 1.5
      : risk === RiskTolerance.Aggressive ? 1.0
      : 1.2;
    if (rr < minRR && successProbability < 80) {
      return { isValid: false, reason: `Risk-to-Reward ratio (${rr.toFixed(2)}) is below the minimum requirement of ${minRR} for ${risk} risk tolerance (and AI confidence is ${successProbability}% which is below the 80% override threshold).` };
    }

    // 7. Maximum target distance sanity — Dynamic based on tradingStyle - Soft limit (Bypassed if high confidence AI setup)
    if (successProbability < 80) {
      const maxTpAtrFactor = style === TradingStyle.Scalp ? 3.0
        : style === TradingStyle.Swing ? 10.0
        : 6.0;
      const atrLimit = style === TradingStyle.Scalp ? (atr5m || 1.0) : (atr1h || 1.5);
      if (tpDistance > maxTpAtrFactor * atrLimit) {
        return { isValid: false, reason: `Take Profit distance ($${tpDistance.toFixed(2)}) is unrealistically wide (exceeds ${maxTpAtrFactor}x ${style === TradingStyle.Scalp ? '5m' : '1h'} ATR of $${(maxTpAtrFactor * atrLimit).toFixed(2)} for ${style} style).` };
      }
    }

    return { isValid: true };
  }
}
