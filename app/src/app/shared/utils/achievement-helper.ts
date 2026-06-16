import { AchievementType } from '@ounce24/types';
import { 
  lucideTrophy, 
  lucideCrown, 
  lucideAward, 
  lucideTrendingUp, 
  lucideZap, 
  lucideFlame, 
  lucideTarget, 
  lucideShieldCheck, 
  lucideCrosshair, 
  lucideCompass, 
  lucideSparkles,
  lucideStar,
  lucideBrain
} from '@ng-icons/lucide';

export const ACHIEVEMENT_ICONS_MAP = {
  lucideTrophy, 
  lucideCrown, 
  lucideAward, 
  lucideTrendingUp, 
  lucideZap, 
  lucideFlame, 
  lucideTarget, 
  lucideShieldCheck, 
  lucideCrosshair, 
  lucideCompass, 
  lucideSparkles,
  lucideStar,
  lucideBrain
};

export function getAchievementIcon(type: AchievementType): string {
  switch (type) {
    case AchievementType.WeekWin:
      return 'lucideCrown';
    case AchievementType.MonthWin:
      return 'lucideTrophy';
    case AchievementType.BestSignalWeek:
      return 'lucideStar';
    case AchievementType.BestSignalMonth:
      return 'lucideAward';
    case AchievementType.Hatrik20Points:
      return 'lucideFlame';
    case AchievementType.FiftyPoint:
      return 'lucideTarget';
    case AchievementType.FiveStreakR1:
      return 'lucideShieldCheck';
    case AchievementType.Winrate60In30:
      return 'lucideCrosshair';
    case AchievementType.OctopusWeekWin:
      return 'lucideCompass';
    case AchievementType.OctopusMonthWin:
      return 'lucideCompass';
    case AchievementType.Octopus5Streak:
      return 'lucideFlame';
    case AchievementType.Octopus10Streak:
      return 'lucideBrain';
    default:
      return 'lucideAward';
  }
}

export function getAchievementClass(type: AchievementType): string {
  switch (type) {
    case AchievementType.WeekWin:
    case AchievementType.MonthWin:
    case AchievementType.BestSignalWeek:
    case AchievementType.BestSignalMonth:
      return 'gold-achievement';
    case AchievementType.OctopusWeekWin:
    case AchievementType.OctopusMonthWin:
    case AchievementType.Octopus5Streak:
    case AchievementType.Octopus10Streak:
      return 'purple-achievement';
    case AchievementType.FiftyPoint:
    case AchievementType.Winrate60In30:
      return 'blue-achievement';
    case AchievementType.Hatrik20Points:
      return 'orange-achievement';
    case AchievementType.FiveStreakR1:
      return 'green-achievement';
    default:
      return 'gold-achievement';
  }
}
