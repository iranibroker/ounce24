import { Signal } from './signal';
import { User, TradingStyle, RiskTolerance } from './user';

export class SignalAnalyze {
  _id: any;
  id: string;

  signal: Signal;

  ouncePrice: number;

  analyzeText: string;

  creator: User;

  totalTokens: number;

  prompt?: string;

  model?: string;

  tradingStyle?: TradingStyle;

  riskTolerance?: RiskTolerance;

  language?: string;

  successProbability?: number;

  createdAt: Date;
}


