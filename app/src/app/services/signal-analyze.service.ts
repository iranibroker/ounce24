import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SignalAnalyzeDialogComponent } from '../components/signal-analyze-dialog/signal-analyze-dialog.component';
import { Signal } from '@ounce24/types';

@Injectable({
  providedIn: 'root',
})
export class SignalAnalyzeService {
  private dialog = inject(MatDialog);

  openSignalAnalyze(signal: Signal): void {
    this.dialog.open(SignalAnalyzeDialogComponent, {
      data: { signal },
      width: '500px',
      maxWidth: '95vw',
      disableClose: true,
    });
  }
} 