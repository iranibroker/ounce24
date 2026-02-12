export class User {
  _id: any;
  id: string;

  name: string;

  title: string;

  avatar?: string;

  defaultScore: number;

  totalScore: number;

  totalSignals: number;

  winRate: number;

  avgRiskReward: number;

  telegramUsername?: string;

  telegramId: number;

  alwaysPublish?: boolean;

  phone?: string;

  resetAt: Date;

  iban: string;

  score?: number;
  weekScore?: number;
  tag: string;
  rank?: number;
  gem?: number;
  alternativeTelegramToken?: string;

  static getFullName(user?: User): string {
    if (!user) return '';
    return user.title || user.name;
  }
}
