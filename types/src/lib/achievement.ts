import { User } from './user';

export enum AchievementType {
  WeekWin = 'WEEK_WIN',
}

export class Achievement {
  id: string;
  type: AchievementType;
  user: User;
  createdAt: Date;
}
