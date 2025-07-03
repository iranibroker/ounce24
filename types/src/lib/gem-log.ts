import { User } from './user';

export enum GemLogAction {
  SignalAnalyze = 'signal_analyze',
  ChangeAvatar = 'change_avatar',
  CloseSignal = 'close_signal',
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