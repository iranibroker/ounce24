import { User } from './user';

export enum GemLogAction {
  SignalAnalyze = 'signal_analyze',
  ChangeAvatar = 'change_avatar',
}

export class GemLog {
  _id: any;
  id: string;

  user: User;

  gemsUsed: number;

  gemsBefore: number;

  gemsAfter: number;

  action: GemLogAction;

  createdAt: Date;
} 