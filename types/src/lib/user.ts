export class User {
  _id: any;
  id: string;

  name: string;

  title: string;

  avatar?: string;

  /** Preferred avatar source: custom (BitBots), Telegram, or Google. */
  avatarSource?: 'bitbots' | 'telegram' | 'google';

  defaultScore: number;

  totalScore: number;

  totalSignals: number;

  winRate: number;

  avgRiskReward: number;

  telegramUsername?: string;

  telegramId: number;

  alwaysPublish?: boolean;

  phone?: string;

  email?: string;

  googleId?: string;

  /** Google profile picture URL, stored so user can switch back to it. */
  googlePicture?: string;

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
