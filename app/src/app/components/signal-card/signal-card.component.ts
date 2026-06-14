import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  saxStarOutline,
  saxActivityOutline,
  saxClockOutline,
  saxPlayOutline,
  saxStopOutline,
  saxCalculatorOutline,
} from '@ng-icons/iconsax/outline';
import {
  saxTrendUpBold,
  saxTrendDownBold,
  saxDiamondsBold,
} from '@ng-icons/iconsax/bold';
import { lucideSparkles } from '@ng-icons/lucide';
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
import { Router } from '@angular/router';

@Component({
  selector: 'app-signal-card',
  imports: [
    NgIcon,
    CommonModule,
    MatCardModule,
    SignalTypeChipComponent,
    MatDividerModule,
    SHARED,
    MatChipsModule,
    MatTooltipModule,
    MatButtonModule,
  ],
  providers: [
    provideIcons({
      saxStarOutline,
      saxActivityOutline,
      saxClockOutline,
      saxPlayOutline,
      saxStopOutline,
      saxDiamondsBold,
      saxTrendUpBold,
      saxTrendDownBold,
      saxCalculatorOutline,
      lucideSparkles,
    }),
  ],
  templateUrl: './signal-card.component.html',
  styleUrl: './signal-card.component.scss',
})
export class SignalCardComponent {
  private readonly ouncePrice = inject(OuncePriceService);
  private readonly dialog = inject(MatDialog);
  private readonly signalAnalyzeService = inject(SignalAnalyzeService);
  private readonly router = inject(Router);

  signal = input.required<Signal>();
  showScore = input(false);
  Signal = Signal;
  SignalStatus = SignalStatus;

  currentPrice = computed(() => this.ouncePrice.value());

  entryPositionPercent = computed(() => {
    const sig = this.signal();
    const loss = sig.loss;
    const profit = sig.profit;
    if (!loss || !profit || loss === profit) return 50;
    const entry = sig.entryPrice;
    const ratio = (entry - profit) / (loss - profit);
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    return clampedRatio * 100;
  });

  currentPositionPercent = computed(() => {
    const sig = this.signal();
    if (
      sig.status !== SignalStatus.Active &&
      sig.status !== SignalStatus.Pending &&
      sig.status !== SignalStatus.Closed
    ) {
      return null;
    }
    const loss = sig.loss;
    const profit = sig.profit;
    if (!loss || !profit || loss === profit) return null;
    const current =
      sig.status === SignalStatus.Closed
        ? sig.closedOuncePrice
        : this.ouncePrice.value();
    if (!current) return null;
    const ratio = (current - profit) / (loss - profit);
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    return clampedRatio * 100;
  });

  getPriceFormat(value: number | undefined | null): string {
    if (value === undefined || value === null) {
      return '1.0-0';
    }
    return value % 1 !== 0 ? '1.2-2' : '1.0-0';
  }

  openCalculator(event: Event) {
    event.stopPropagation();
    this.router.navigate(['/signals', this.signal().id], {
      fragment: 'calculator',
    });
  }

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
