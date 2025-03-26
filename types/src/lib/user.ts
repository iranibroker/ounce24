export class User {
  _id: any;
  id: string;

  name: string;

  title: string;

  defaultScore: number;

  totalScore: number;

  totalSignals: number;

  winRate: number;

  avgRiskReward: number;

  telegramUsername?: string;

  telegramId: number;

  phone: string;

  resetAt: Date;

  iban: string;

  score?: number;
  tag: string;
}
