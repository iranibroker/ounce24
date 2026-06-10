import { Signal } from './signal';

export enum AiEvaluationType {
  Analyze = 'ANALYZE',
  Generate = 'GENERATE',
  Copilot = 'COPILOT',
}

export enum AiEvaluationOutcome {
  Win = 'WIN',
  Loss = 'LOSS',
  Neutral = 'NEUTRAL',
  Canceled = 'CANCELED',
  None = 'NONE',
}

export class AiEvaluation {
  _id: any;
  id: string;

  signal?: Signal;

  type: AiEvaluationType;

  prompt: string;

  response: any; // Raw JSON response object

  model: string;

  promptTokens: number;

  completionTokens: number;

  totalTokens: number;

  latencyMs: number;

  predictedProbability?: number;

  actualOutcome?: AiEvaluationOutcome;

  actualPip?: number;

  calibrationError?: number; // absolute difference between predicted probability and actual binary outcome (100 or 0)

  feedback?: string;

  createdAt?: Date;

  updatedAt?: Date;
}
