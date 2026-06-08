import { Component, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Signal, SignalStatus } from '@ounce24/types';
import { injectInfiniteQuery } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DataLoadingComponent } from '../../../components/data-loading/data-loading.component';
import { SignalCardComponent } from '../../../components/signal-card/signal-card.component';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxAddOutline, saxArrowLeftOutline } from '@ng-icons/iconsax/outline';
import { saxDiamondsBold } from '@ng-icons/iconsax/bold';

import { AuthService } from '../../../services/auth.service';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-signals-list',
  standalone: true,
  imports: [
    NgIcon,
    CommonModule,
    RouterModule,
    MatButtonToggleModule,
    MatButtonModule,
    FormsModule,
    TranslateModule,
    SignalCardComponent,
    DataLoadingComponent,
    EmptyStateComponent
  ],
  providers: [provideIcons({ saxAddOutline, saxDiamondsBold, saxArrowLeftOutline })],
  templateUrl: './signals.component.html',
  styleUrls: ['./signals.component.scss']
})
export class SignalsComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  status = signal<string>(SignalStatus.Active);
  filter = signal<'all' | 'myself' | 'following' | 'bookmarked'>('all');
  SignalStatus = SignalStatus;

  isLoggedIn = computed(() => !!this.auth.userQuery.data());

  isWeekend = computed(() => {
    const now = new Date();
    const nyParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    }).formatToParts(now);

    const partVal = (type: string) => parseInt(nyParts.find(p => p.type === type)!.value, 10);
    const nyHour = partVal('hour');
    const nyWeekdayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short'
    }).format(now);
    
    if (nyWeekdayStr === 'Fri') {
      return nyHour >= 17;
    }
    if (nyWeekdayStr === 'Sat') {
      return true;
    }
    if (nyWeekdayStr === 'Sun') {
      return nyHour < 17;
    }
    return false;
  });

  constructor() {
    // Initialize status and filter from query params
    const statusParam = this.route.snapshot.queryParams['status'];
    if (statusParam && (statusParam === 'all' || Object.values(SignalStatus).includes(statusParam as SignalStatus))) {
      this.status.set(statusParam);
    }
    const filterParam = this.route.snapshot.queryParams['filter'];
    if (filterParam && ['all', 'myself', 'following', 'bookmarked'].includes(filterParam)) {
      this.filter.set(filterParam as any);
    }

    // Update URL when status or filter changes
    effect(() => {
      const currentStatus = this.status();
      const currentFilter = this.filter();
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { status: currentStatus, filter: currentFilter },
        queryParamsHandling: 'merge'
      });
    });
  }

  query = injectInfiniteQuery(() => ({
    queryKey: ['signals', 'status', this.status(), this.filter()],
    queryFn: async ({ pageParam }) => {
      return lastValueFrom(
        this.http.get<Signal[]>('/api/signals/status/' + this.status(), {
          params: {
            page: pageParam,
            filter: this.filter(),
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
