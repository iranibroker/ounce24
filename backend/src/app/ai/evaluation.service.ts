import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AiEvaluation,
  AiEvaluationType,
  AiEvaluationOutcome,
  Signal,
  SignalStatus,
  SignalType,
} from '@ounce24/types';
import { EVENTS } from '../consts';

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    @InjectModel(AiEvaluation.name)
    private readonly aiEvaluationModel: Model<AiEvaluation>
  ) {}

  /**
   * Logs a new AI execution telemetry record.
   */
  async logEvaluation(data: {
    signalId?: string;
    type: AiEvaluationType;
    prompt: string;
    response: any;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    predictedProbability?: number;
  }): Promise<AiEvaluation> {
    try {
      const evaluation = await this.aiEvaluationModel.create({
        signal: data.signalId || null,
        type: data.type,
        prompt: data.prompt,
        response: data.response,
        model: data.model,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,
        latencyMs: data.latencyMs,
        predictedProbability: data.predictedProbability,
        actualOutcome: AiEvaluationOutcome.None,
      });

      this.logger.log(`Logged AI telemetry evaluation ID ${evaluation._id} for type ${data.type}`);
      return evaluation;
    } catch (error) {
      this.logger.error('Failed to log AI evaluation telemetry:', error);
      throw error;
    }
  }

  /**
   * Feedback Loop listener: Updates AI evaluations when a signal is closed.
   */
  @OnEvent(EVENTS.SIGNAL_CLOSED)
  async handleSignalClosed(signal: Signal) {
    const signalId = signal._id || (signal as any).id;
    if (!signalId) return;

    this.logger.log(`Feedback Loop: Signal ${signalId} closed. Evaluating AI predictions...`);

    try {
      const isSell = signal.type === SignalType.Sell;
      const entryPrice = signal.entryPrice;
      const closedPrice = signal.closedOuncePrice || 0;

      // Calculate actual pip and outcome
      const diff = isSell ? entryPrice - closedPrice : closedPrice - entryPrice;
      const actualPip = Number((diff * 10).toFixed(3));
      const actualOutcome = actualPip >= 0 ? AiEvaluationOutcome.Win : AiEvaluationOutcome.Loss;

      // Update all AI evaluations linked to this signal
      const evaluations = await this.aiEvaluationModel.find({ signal: signalId }).exec();

      for (const evalDoc of evaluations) {
        let calibrationError: number | undefined;

        if (evalDoc.predictedProbability !== undefined && evalDoc.predictedProbability !== null) {
          const binaryOutcome = actualOutcome === AiEvaluationOutcome.Win ? 100 : 0;
          calibrationError = Math.abs(evalDoc.predictedProbability - binaryOutcome);
        }

        evalDoc.actualOutcome = actualOutcome;
        evalDoc.actualPip = actualPip;
        if (calibrationError !== undefined) {
          evalDoc.calibrationError = calibrationError;
        }

        await evalDoc.save();
        this.logger.log(
          `Updated AI evaluation ${evalDoc._id}: outcome=${actualOutcome}, pip=${actualPip}, error=${calibrationError}`
        );
      }
    } catch (error) {
      this.logger.error(`Failed to handle feedback loop for closed signal ${signalId}:`, error);
    }
  }

  /**
   * Feedback Loop listener: Updates AI evaluations when a signal is canceled.
   */
  @OnEvent(EVENTS.SIGNAL_CANCELED)
  async handleSignalCanceled(signal: Signal) {
    const signalId = signal._id || (signal as any).id;
    if (!signalId) return;

    this.logger.log(`Feedback Loop: Signal ${signalId} canceled. Updating AI evaluations...`);

    try {
      await this.aiEvaluationModel.updateMany(
        { signal: signalId },
        {
          $set: {
            actualOutcome: AiEvaluationOutcome.Canceled,
            calibrationError: null,
          },
        }
      ).exec();
    } catch (error) {
      this.logger.error(`Failed to handle feedback loop for canceled signal ${signalId}:`, error);
    }
  }
}
