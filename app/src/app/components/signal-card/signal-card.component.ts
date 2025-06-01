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
  ],
  templateUrl: './signal-card.component.html',
  styleUrl: './signal-card.component.scss',
})
export class SignalCardComponent {
  private readonly ouncePrice = inject(OuncePriceService);
  signal = input.required<Signal>();
  showScore = input(false);
  Signal = Signal;
  SignalStatus = SignalStatus;
  private readonly dialog = inject(MatDialog);

  pip = computed(() => {
    if (this.signal().status === SignalStatus.Active) {
      const price = this.ouncePrice.value();
      return Signal.getActivePip(this.signal(), price);
    } else if (this.signal().status === SignalStatus.Closed) {
      return Signal.getActivePip(this.signal(), this.signal().closedOuncePrice);
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
}
