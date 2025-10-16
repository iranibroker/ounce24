import { Signal } from './signal';
import { User } from './user';

export class SignalAnalyze {
  _id: any;
  id: string;

  signal: Signal;

  ouncePrice: number;

  analyzeText: string;

  creator: User;

  totalTokens: number;

  createdAt: Date;
}

