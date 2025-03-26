import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Signal, SignalStatus } from '@ounce24/types';
import { injectInfiniteQuery } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { SignalCardComponent } from '../../components/signal-card/signal-card.component';
import { DataLoadingComponent } from '../../components/data-loading/data-loading.component';
import { SHARED } from '../../shared';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormsModule } from '@angular/forms';
const PAGE_SIZE = 20;

@Component({
  selector: 'app-signals',
  imports: [
    CommonModule,
    SignalCardComponent,
    DataLoadingComponent,
    SHARED,
    MatButtonModule,
    MatButtonToggleModule,
    FormsModule,
  ],
  templateUrl: './signals.component.html',
  styleUrl: './signals.component.scss',
})
export class SignalsComponent {
  private readonly http = inject(HttpClient);

  status = signal<SignalStatus>(SignalStatus.Active);
  SignalStatus = SignalStatus;

  query = injectInfiniteQuery(() => ({
    queryKey: ['signals', 'status', this.status()],
    queryFn: async ({ pageParam }) => {
      return lastValueFrom(
        this.http.get<Signal[]>('/api/signals/status/' + this.status(), {
          params: {
            page: pageParam,
          },
        }),
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPageData, allPages, lastPage) =>
      lastPageData.length === PAGE_SIZE ? lastPage + 1 : null,
    refetchInterval: 30000,
  }));

  data = computed(() => {
    return this.query.data()?.pages?.flat();
  });
}
