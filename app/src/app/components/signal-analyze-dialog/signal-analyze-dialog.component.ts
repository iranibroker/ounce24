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
import { Signal } from '@ounce24/types';
import { SHARED } from '../../shared';
import { DataLoadingComponent } from '../data-loading/data-loading.component';
import { injectMutation } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { GemRequiredDialogComponent } from '../gem-required-dialog/gem-required-dialog.component';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { AnalyticsService } from '../../services/analytics.service';
import { AuthService } from '../../services/auth.service';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSparkles } from '@ng-icons/lucide';

interface SignalAnalysisResponse {
  analysis: string;
  successProbability?: number;
  signal: Signal;
  currentPrice: number;
}

interface SignalAnalyzeData {
  signal: Signal;
}

@Component({
  selector: 'app-signal-analyze-dialog',
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
    NgIcon,
  ],
  providers: [provideIcons({ lucideSparkles })],
  templateUrl: './signal-analyze-dialog.component.html',
  styleUrls: ['./signal-analyze-dialog.component.scss'],
})
export class SignalAnalyzeDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private analyticsService = inject(AnalyticsService);
  private translate = inject(TranslateService);
  private auth = inject(AuthService);
  signal!: Signal;

  constructor(
    public dialogRef: MatDialogRef<SignalAnalyzeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SignalAnalyzeData,
  ) {}

  analyzeMutation = injectMutation(() => ({
    mutationFn: (args: { signal: Signal }) => {
      const url = '/api/signals/analyze';
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
    this.analyticsService.trackEvent('signal_analyze_dialog_opened');
  }

  close() {
    this.dialogRef.close();
  }

  analyzeSignal() {
    this.analyticsService.trackEvent('analyze_signal');
    this.analyzeMutation.mutate({
      signal: this.signal,
    });
  }
}
