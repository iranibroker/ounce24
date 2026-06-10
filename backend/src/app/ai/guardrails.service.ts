import { Injectable } from '@nestjs/common';
import { SignalType, TradingStyle } from '@ounce24/types';

export interface GuardrailInput {
  type: SignalType;
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  instantEntry: boolean;
  isVolatile: boolean;
  atr5m: number;
  atr1h: number;
}

export interface GuardrailResult {
  isValid: boolean;
  reason?: string;
}

@Injectable()
export class GuardrailsService {
  /**
   * Validates generated signals against technical, risk, and logical criteria.
   */
  validateSignal(input: GuardrailInput): GuardrailResult {
    const { type, entryPrice, takeProfit, stopLoss, instantEntry, isVolatile, atr5m, atr1h } = input;

    // 1. Check basic mathematical sanity
    if (entryPrice <= 0 || takeProfit <= 0 || stopLoss <= 0) {
      return { isValid: false, reason: 'Prices must be greater than zero.' };
    }

    const isBuy = type === SignalType.Buy;

    // 2. Validate orientation of entry, TP, and SL
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

    // 3. Volatility restriction (No Instant Entry during High Volatility)
    if (isVolatile && instantEntry) {
      return { isValid: false, reason: 'Instant entries are prohibited during high volatility states.' };
    }

    // 4. Stop Loss distance sanity
    const slDistance = Math.abs(entryPrice - stopLoss);
    if (slDistance < 1.0) {
      return { isValid: false, reason: `Stop Loss distance ($${slDistance.toFixed(2)}) is too narrow (minimum distance is $1.0).` };
    }

    // 5. Risk-Reward Ratio (R:R) sanity check
    const tpDistance = Math.abs(takeProfit - entryPrice);
    const rr = slDistance > 0 ? tpDistance / slDistance : 0;
    if (rr < 1.0) {
      return { isValid: false, reason: `Risk-to-Reward ratio (${rr.toFixed(2)}) is below the absolute minimum requirement of 1.0.` };
    }

    // 6. Maximum target distance sanity (TP shouldn't exceed 6.0x ATR to avoid dream targets)
    const maxTpAtrFactor = 6.0;
    const atrLimit = atr1h || 1.5;
    if (tpDistance > maxTpAtrFactor * atrLimit) {
      return { isValid: false, reason: `Take Profit distance ($${tpDistance.toFixed(2)}) is unrealistically wide (exceeds ${maxTpAtrFactor}x 1h ATR of $${(maxTpAtrFactor * atrLimit).toFixed(2)}).` };
    }

    return { isValid: true };
  }
}
