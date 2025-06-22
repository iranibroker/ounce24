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
import { Signal } from '@ounce24/types';
import { SHARED } from '../../shared';
import { DataLoadingComponent } from '../data-loading/data-loading.component';
import { injectMutation } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { GemRequiredDialogComponent } from '../gem-required-dialog/gem-required-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

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
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatDividerModule,
    SHARED,
    DataLoadingComponent,
    MatToolbarModule,
  ],
  templateUrl: './signal-analyze-bottom-sheet.component.html',
  styleUrls: ['./signal-analyze-bottom-sheet.component.scss'],
})
export class SignalAnalyzeBottomSheetComponent implements OnInit {
  private bottomSheetRef = inject(MatBottomSheetRef);
  private http = inject(HttpClient);
  private data = inject(MAT_BOTTOM_SHEET_DATA) as SignalAnalyzeData;
  private dialog = inject(MatDialog);
  private translate = inject(TranslateService);
  signal!: Signal;

  analyzeMutation = injectMutation(() => ({
    mutationFn: (signal: Signal) =>
      lastValueFrom(
        this.http.post<SignalAnalysisResponse>('/api/signals/analyze', signal),
      ),
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
  }

  close() {
    this.bottomSheetRef.dismiss();
  }

  analyzeSignal() {
    this.analyzeMutation.mutate(this.signal);
  }
}
