import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { Signal, SignalStatus } from '@ounce24/types';
import { SignalTypeChipComponent } from '../signal-type-chip/signal-type-chip.component';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { SHARED } from '../../shared';
import { OuncePriceService } from '../../services/ounce-price.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScoreInfoDialogComponent } from '../score-info-dialog/score-info-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { SignalAnalyzeService } from '../../services/signal-analyze.service';

@Component({
  selector: 'app-signal-card',
  imports: [
    CommonModule,
    MatCardModule,
    SignalTypeChipComponent,
    MatDividerModule,
    SHARED,
    MatChipsModule,
    MatTooltipModule,
    MatButtonModule,
  ],
  templateUrl: './signal-card.component.html',
  styleUrl: './signal-card.component.scss',
})
export class SignalCardComponent {
  private readonly ouncePrice = inject(OuncePriceService);
  private readonly dialog = inject(MatDialog);
  private readonly signalAnalyzeService = inject(SignalAnalyzeService);
  
  signal = input.required<Signal>();
  showScore = input(false);
  Signal = Signal;
  SignalStatus = SignalStatus;

  pip = computed(() => {
    if (this.signal().status === SignalStatus.Active) {
      const price = this.ouncePrice.value();
      return Signal.getActivePip(this.signal(), price);
    } else if (this.signal().status === SignalStatus.Closed) {
      return this.signal().pip;
    }
    return null;
  });

  openScoreInfo() {
    this.dialog.open(ScoreInfoDialogComponent, {
      data: {
        score: this.signal().score,
      },
    });
  }

  openSignalAnalyze(event: Event) {
    event.stopPropagation();
    this.signalAnalyzeService.openSignalAnalyze(this.signal());
  }
}
