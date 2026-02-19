export type OctopusDirection = 'up' | 'down';

export class OctopusPrediction {
  _id?: any;
  id?: string;
  user: string;
  direction: OctopusDirection;
  votePrice: number;
  voteDate: Date;
  closePrice?: number;
  points?: number;
  createdAt: Date;
}
