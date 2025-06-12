import { Component, computed, inject } from '@angular/core';
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

@Component({
  selector: 'app-signal-info',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatDividerModule,
    RouterModule,
    SHARED,
    SignalCardComponent,
    MatListModule,
    DataLoadingComponent,
  ],
  templateUrl: './signal-info.component.html',
  styleUrls: ['./signal-info.component.scss'],
})
export class SignalInfoComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ouncePrice = inject(OuncePriceService);
  SignalStatus = SignalStatus;
  Signal = Signal;

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
}
