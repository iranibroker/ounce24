import { User } from './user';

export enum AchievementType {
  // Competition Achievements
  WeekWin = 'WEEK_WIN',
  MonthWin = 'MONTH_WIN',
  BestSignalWeek = 'BEST_SIGNAL_WEEK',
  BestSignalMonth = 'BEST_SIGNAL_MONTH',

  // Individual Achievements
  Hatrik20Points = 'HATRIK_20_POINTS',
  FiftyPoint = 'FIFTY_POINT',
  FiveStreakR1 = 'FIVE_STREAK_R1',
  Winrate60In30 = 'WINRATE_60_IN_30',

  // Octopus Achievements
  OctopusWeekWin = 'OCTOPUS_WEEK_WIN',
  OctopusMonthWin = 'OCTOPUS_MONTH_WIN',
  Octopus5Streak = 'OCTOPUS_5_STREAK',
  Octopus10Streak = 'OCTOPUS_10_STREAK',
}

export class Achievement {
  id: string;
  type: AchievementType;
  user: User;
  createdAt: Date;
}
