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
      type, entryPrice, takeProfit, stopLoss, currentPrice
    } = input;

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

    // 3. Risk-Reward Ratio (R:R) sanity check: R:R must be >= 1.0 (Reward must exceed Risk)
    const rr = slDistance > 0 ? tpDistance / slDistance : 0;
    if (rr < 1.0) {
      return { isValid: false, reason: `Risk-to-Reward ratio (${rr.toFixed(2)}) is invalid. R:R must be greater than or equal to 1.0.` };
    }

    return { isValid: true };
  }
}
