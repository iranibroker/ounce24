import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxArrowLeftOutline, saxCloseCircleOutline, saxStopOutline, saxInfoCircleOutline } from '@ng-icons/iconsax/outline';
import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Signal, SignalStatus } from '@ounce24/types';
import { OuncePriceService } from '../../../services/ounce-price.service';
import { SHARED } from '../../../shared';
import { SignalCardComponent } from '../../../components/signal-card/signal-card.component';
import { MatListModule } from '@angular/material/list';
import { DataLoadingComponent } from '../../../components/data-loading/data-loading.component';
import { VolumeCalculatorComponent } from '../../../components/volume-calculator/volume-calculator.component';
import { AuthService } from '../../../services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-signal-info',
  standalone: true,
  imports: [NgIcon, CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatDividerModule,
    RouterModule,
    SHARED,
    SignalCardComponent,
    MatListModule,
    DataLoadingComponent,
    VolumeCalculatorComponent,
    TranslateModule,
    MatSnackBarModule,],
  providers: [provideIcons({ saxArrowLeftOutline, saxCloseCircleOutline, saxStopOutline, saxInfoCircleOutline })],
  templateUrl: './signal-info.component.html',
  styleUrls: ['./signal-info.component.scss'],
})
export class SignalInfoComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ouncePrice = inject(OuncePriceService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  SignalStatus = SignalStatus;
  Signal = Signal;

  currentUser = computed(() => this.auth.userQuery.data());

  isOwner = computed(() => {
    const signal = this.data();
    const user = this.currentUser();
    if (!signal || !user) return false;
    const ownerId = signal.owner?.id || signal.owner?._id || (signal.owner as any);
    const userId = user.id || user._id;
    return ownerId === userId;
  });

  canRiskFree = computed(() => {
    const signal = this.data();
    if (!this.isOwner() || !signal) return false;
    return signal.status === SignalStatus.Active && !signal.riskFree && (this.getActivePip(signal) ?? -1) >= 0;
  });

  ngOnInit() {
    this.route.fragment.subscribe(fragment => {
      if (fragment === 'calculator') {
        setTimeout(() => {
          const el = document.getElementById('volume-calculator');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    });
  }

  query = injectQuery(() => ({
    queryKey: ['signal', this.route.snapshot.params['id']],
    queryFn: () =>
      lastValueFrom(
        this.http.get<Signal>(
          `/api/signals/${this.route.snapshot.params['id']}`,
        ),
      ),
  }));

  data = computed(() => this.query.data() || history.state?.signal);

  getActivePip(signal: Signal): number | null {
    if (signal.status === SignalStatus.Active) {
      return Signal.getActivePip(signal, this.ouncePrice.value());
    } else if (signal.status === SignalStatus.Closed) {
      return signal.pip;
    }
    return null;
  }

  cancelSignal() {
    const signal = this.data();
    if (!signal) return;
    if (confirm(this.translate.instant('signal.actions.cancelConfirm'))) {
      this.http.delete(`/api/signals/${signal.id}`).subscribe({
        next: () => {
          this.snack.open(this.translate.instant('signal.actions.cancelSuccess'), '', { duration: 3000 });
          this.query.refetch();
        },
        error: (err) => {
          this.snack.open(err.error?.message || 'Error canceling signal', '', { duration: 3000 });
        }
      });
    }
  }

  closeSignalManually() {
    const signal = this.data();
    if (!signal) return;
    if (confirm(this.translate.instant('signal.actions.closeConfirm'))) {
      this.http.post(`/api/signals/${signal.id}/close`, {}).subscribe({
        next: () => {
          this.snack.open(this.translate.instant('signal.actions.closeSuccess'), '', { duration: 3000 });
          this.query.refetch();
        },
        error: (err) => {
          this.snack.open(err.error?.message || 'Error closing signal', '', { duration: 3000 });
        }
      });
    }
  }

  makeRiskFree() {
    const signal = this.data();
    if (!signal) return;
    if (confirm(this.translate.instant('signal.actions.riskFreeConfirm'))) {
      this.http.post(`/api/signals/${signal.id}/riskfree`, {}).subscribe({
        next: () => {
          this.snack.open(this.translate.instant('signal.actions.riskFreeSuccess'), '', { duration: 3000 });
          this.query.refetch();
        },
        error: (err) => {
          this.snack.open(err.error?.message || 'Error setting signal to risk-free', '', { duration: 3000 });
        }
      });
    }
  }
}
