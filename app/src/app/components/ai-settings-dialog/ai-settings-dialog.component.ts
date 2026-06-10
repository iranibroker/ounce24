import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TradingStyle, RiskTolerance } from '@ounce24/types';
import { DataLoadingComponent } from '../data-loading/data-loading.component';
import { GemRequiredDialogComponent } from '../gem-required-dialog/gem-required-dialog.component';

export interface AiSettingsDialogData {
  title: string;
  description?: string;
  confirmLabel: string;
  tradingStyle: TradingStyle;
  riskTolerance: RiskTolerance;
  hideTradingStyle?: boolean;
}

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

@Component({
  selector: 'app-ai-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    TranslateModule,
    FormsModule,
    DataLoadingComponent,
  ],
  templateUrl: './ai-settings-dialog.component.html',
  styleUrls: ['./ai-settings-dialog.component.scss'],
})
export class AiSettingsDialogComponent {
  public dialogRef = inject(MatDialogRef<AiSettingsDialogComponent>);
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private translate = inject(TranslateService);

  public tradingStyle: TradingStyle;
  public riskTolerance: RiskTolerance;

  public isGenerating = false;
  public errorText: string | null = null;
  public prompt: string | null = null;
  public isPromptCopied = false;
  
  TradingStyle = TradingStyle;
  RiskTolerance = RiskTolerance;

  constructor(@Inject(MAT_DIALOG_DATA) public data: AiSettingsDialogData) {
    this.tradingStyle = data.tradingStyle || TradingStyle.Day;
    this.riskTolerance = data.riskTolerance || RiskTolerance.Moderate;
  }

  generateSignal(): void {
    this.isGenerating = true;
    this.errorText = null;
    this.prompt = null;

    const url = `/api/signals/generate?tradingStyle=${this.tradingStyle}&riskTolerance=${this.riskTolerance}`;
    this.http.post<SignalGenerationResponse>(url, {}).subscribe({
      next: (response) => {
        this.isGenerating = false;
        if (response.signal) {
          this.dialogRef.close(response.signal);
        } else {
          this.errorText = response.rawText || this.translate.instant('addSignal.noSetupFound');
          this.prompt = response.prompt || null;
        }
      },
      error: (error: any) => {
        this.isGenerating = false;
        if (error?.status === 406) {
          this.dialog.open(GemRequiredDialogComponent, {
            width: '400px',
            data: {
              description: this.translate.instant('addSignal.gemRequired'),
            },
          }).afterClosed().subscribe(() => {
            this.cancel();
          });
        } else {
          this.errorText = this.translate.instant('addSignal.aiGenerateError');
        }
      }
    });
  }

  copyPrompt(prompt: string): void {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt).then(() => {
      this.isPromptCopied = true;
      setTimeout(() => {
        this.isPromptCopied = false;
      }, 2000);
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
