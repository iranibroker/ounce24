import { User } from './user';

export class Follow {
  _id: any;
  id: string;

  follower: User;

  following: User;

  createdAt: Date;
  updatedAt: Date;
}
