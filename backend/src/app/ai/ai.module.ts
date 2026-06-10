import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SchemasModule } from '../schemas/schemas.module';
import { AiClientService } from './ai-client.service';
import { ContextBuilderService } from './context-builder.service';
import { GuardrailsService } from './guardrails.service';
import { EvaluationService } from './evaluation.service';
import { AiOrchestratorService } from './ai-orchestrator.service';

@Module({
  imports: [ConfigModule, SchemasModule],
  providers: [
    AiClientService,
    ContextBuilderService,
    GuardrailsService,
    EvaluationService,
    AiOrchestratorService,
  ],
  exports: [AiOrchestratorService],
})
export class AiModule {}
