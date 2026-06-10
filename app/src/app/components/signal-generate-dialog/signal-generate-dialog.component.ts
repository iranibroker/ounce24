import { Component, inject, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialog,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { TradingStyle, RiskTolerance } from '@ounce24/types';
import { SHARED } from '../../shared';
import { DataLoadingComponent } from '../data-loading/data-loading.component';
import { injectMutation } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { GemRequiredDialogComponent } from '../gem-required-dialog/gem-required-dialog.component';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { AnalyticsService } from '../../services/analytics.service';

interface GeneratedSignal {
  type: 'buy' | 'sell';
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  instantEntry: boolean;
  successProbability?: number;
  generationAnalysis?: string;
}

interface SignalGenerationResponse {
  signal: GeneratedSignal | null;
  rawText: string;
  parseError: boolean;
  prompt?: string;
}

interface SignalGenerateData {
  tradingStyle: TradingStyle;
  riskTolerance: RiskTolerance;
}

@Component({
  selector: 'app-signal-generate-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatDividerModule,
    MatDialogModule,
    TranslateModule,
    SHARED,
    DataLoadingComponent,
  ],
  templateUrl: './signal-generate-dialog.component.html',
  styleUrls: ['./signal-generate-dialog.component.scss'],
})
export class SignalGenerateDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private analyticsService = inject(AnalyticsService);
  private translate = inject(TranslateService);
  
  public isPromptCopied = false;

  constructor(
    public dialogRef: MatDialogRef<SignalGenerateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SignalGenerateData,
  ) {}

  generateMutation = injectMutation(() => ({
    mutationFn: (args: SignalGenerateData) => {
      const url = `/api/signals/generate?tradingStyle=${args.tradingStyle}&riskTolerance=${args.riskTolerance}`;
      return lastValueFrom(
        this.http.post<SignalGenerationResponse>(url, {}),
      );
    },
    onError: (error: any) => {
      if (error?.status === 406) {
        this.dialog
          .open(GemRequiredDialogComponent, {
            width: '400px',
            data: {
              description: this.translate.instant('addSignal.gemRequired'),
            },
          })
          .afterClosed()
          .subscribe(() => {
            this.close();
          });
      }
    },
  }));

  ngOnInit() {
    this.analyticsService.trackEvent('signal_generate_dialog_opened');
    this.generateMutation.mutate(this.data);
  }

  close(signal?: GeneratedSignal) {
    this.dialogRef.close(signal);
  }

  copyPrompt(prompt: string) {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt).then(() => {
      this.isPromptCopied = true;
      setTimeout(() => {
        this.isPromptCopied = false;
      }, 2000);
    });
  }
}
