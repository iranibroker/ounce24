import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxCloseCircleOutline, saxActivityOutline, saxStarOutline } from '@ng-icons/iconsax/outline';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatBottomSheetRef,
  MAT_BOTTOM_SHEET_DATA,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { Signal, TradingStyle, RiskTolerance } from '@ounce24/types';
import { SHARED } from '../../shared';
import { DataLoadingComponent } from '../data-loading/data-loading.component';
import { injectMutation } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { GemRequiredDialogComponent } from '../gem-required-dialog/gem-required-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { AnalyticsService } from '../../services/analytics.service';
import { AuthService } from '../../services/auth.service';
import { AiSettingsDialogComponent } from '../ai-settings-dialog/ai-settings-dialog.component';

interface SignalAnalysisResponse {
  analysis: string;
  signal: Signal;
  currentPrice: number;
}

interface SignalAnalyzeData {
  signal: Signal;
}

@Component({
  selector: 'app-signal-analyze-bottom-sheet',
  standalone: true,
  imports: [CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatDividerModule,
    SHARED,
    DataLoadingComponent,
    MatToolbarModule,
    NgIcon],
  providers: [provideIcons({ saxCloseCircleOutline, saxActivityOutline, saxStarOutline })],
  templateUrl: './signal-analyze-bottom-sheet.component.html',
  styleUrls: ['./signal-analyze-bottom-sheet.component.scss'],
})
export class SignalAnalyzeBottomSheetComponent implements OnInit {
  private bottomSheetRef = inject(MatBottomSheetRef);
  private http = inject(HttpClient);
  private data = inject(MAT_BOTTOM_SHEET_DATA) as SignalAnalyzeData;
  private dialog = inject(MatDialog);
  private analyticsService = inject(AnalyticsService);
  private translate = inject(TranslateService);
  private auth = inject(AuthService);
  signal!: Signal;

  analyzeMutation = injectMutation(() => ({
    mutationFn: (args: { signal: Signal; tradingStyle?: TradingStyle; riskTolerance?: RiskTolerance }) => {
      let url = '/api/signals/analyze';
      const params: string[] = [];
      if (args.tradingStyle) params.push(`tradingStyle=${args.tradingStyle}`);
      if (args.riskTolerance) params.push(`riskTolerance=${args.riskTolerance}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      return lastValueFrom(
        this.http.post<SignalAnalysisResponse>(url, args.signal),
      );
    },
    onError: (error: any) => {
      if (error?.status === 406) {
        this.dialog
          .open(GemRequiredDialogComponent, {
            width: '400px',
            data: {
              description: this.translate.instant('signalAnalyze.noGems'),
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
    this.signal = this.data.signal;
    this.analyticsService.trackEvent('signal_analyze_bottom_sheet_opened');
  }

  close() {
    this.bottomSheetRef.dismiss();
  }

  analyzeSignal() {
    this.analyticsService.trackEvent('analyze_signal');
    
    const user = this.auth.userQuery.data();
    const currentStyle = user?.tradingStyle || TradingStyle.Day;
    const currentRisk = user?.riskTolerance || RiskTolerance.Moderate;

    const dialogRef = this.dialog.open(AiSettingsDialogComponent, {
      width: '450px',
      maxWidth: '95vw',
      data: {
        title: 'aiSettingsDialog.title',
        description: 'aiSettingsDialog.description',
        confirmLabel: 'aiSettingsDialog.confirmAnalyze',
        tradingStyle: currentStyle,
        riskTolerance: currentRisk,
        hideTradingStyle: true,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.analyzeMutation.mutate({
          signal: this.signal,
          tradingStyle: result.tradingStyle,
          riskTolerance: result.riskTolerance,
        });
      }
    });
  }
}
