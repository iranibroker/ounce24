import { User } from './user';

export enum GemLogAction {
  SignalAnalyze = 'signal_analyze',
  ChangeAvatar = 'change_avatar',
  CloseSignal = 'close_signal',
  GenerateSignal = 'generate_signal',
  UnlockAchievement = 'unlock_achievement',
  AiShieldEnable = 'ai_shield_enable',
  FirstSignalReward = 'first_signal_reward',
  BypassDailyLimit = 'bypass_daily_limit',
}

export class GemLog {
  _id: any;
  id: string;

  user: User;

  gemsChange: number;

  gemsBefore: number;

  gemsAfter: number;

  action: GemLogAction;

  createdAt: Date;
} 