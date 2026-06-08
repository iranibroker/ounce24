export enum TradingStyle {
  Scalp = 'SCALP',
  Day = 'DAY',
  Swing = 'SWING',
}

export enum RiskTolerance {
  Conservative = 'CONSERVATIVE',
  Moderate = 'MODERATE',
  Aggressive = 'AGGRESSIVE',
}

export class User {
  _id: any;
  id: string;

  createdAt?: Date;

  name: string;

  title: string;

  tradingStyle?: TradingStyle;
  riskTolerance?: RiskTolerance;

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
  monthScore?: number;
  tag: string;
  rank?: number;
  gem?: number;
  alternativeTelegramToken?: string;
  language?: string;

  /** Notification channel flags — stored in DB */
  notifPrice?: boolean;        // قیمت لحظه‌ای اونس
  notifSignalFollow?: boolean; // وضعیت سیگنال‌های دنبال شده
  notifAiShield?: boolean;     // سپر هوشمند
  
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean;

  static getFullName(user?: User): string {
    if (!user) return '';
    return user.title || user.name;
  }
}
