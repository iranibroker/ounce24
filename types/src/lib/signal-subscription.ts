import { Signal } from './signal';
import { User } from './user';

export class SignalSubscription {
  _id: any;
  id: string;

  signal: Signal;

  user: User;

  followStatus: boolean;

  aiShield: boolean;

  createdAt: Date;
  updatedAt: Date;
}
