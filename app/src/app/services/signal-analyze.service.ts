import { Injectable, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { SignalAnalyzeBottomSheetComponent } from '../components/signal-analyze-bottom-sheet/signal-analyze-bottom-sheet.component';
import { Signal } from '@ounce24/types';

@Injectable({
  providedIn: 'root',
})
export class SignalAnalyzeService {
  private bottomSheet = inject(MatBottomSheet);

  openSignalAnalyze(signal: Signal): void {
    this.bottomSheet.open(SignalAnalyzeBottomSheetComponent, {
      data: { signal },
      panelClass: 'signal-analyze-bottom-sheet',
    });
  }
} 