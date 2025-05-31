import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { injectQuery, injectInfiniteQuery } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Signal } from '@ounce24/types';
import { SignalCardComponent } from '../../../components/signal-card/signal-card.component';
import { DataLoadingComponent } from '../../../components/data-loading/data-loading.component';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatDividerModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    TranslateModule,
    SignalCardComponent,
    DataLoadingComponent,
    EmptyStateComponent
  ],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  userQuery = injectQuery(() => ({
    queryKey: ['user', this.route.snapshot.params['id']],
    queryFn: () => lastValueFrom(
      this.http.get<any>(`/api/users/${this.route.snapshot.params['id']}`)
    )
  }));

  signalsQuery = injectInfiniteQuery(() => ({
    queryKey: ['user-signals', this.route.snapshot.params['id']],
    queryFn: async ({ pageParam }) => {
      return lastValueFrom(
        this.http.get<Signal[]>(`/api/users/${this.route.snapshot.params['id']}/signals`, {
          params: {
            page: pageParam,
          },
        })
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPageData, allPages, lastPage) =>
      lastPageData.length === PAGE_SIZE ? lastPage + 1 : null,
  }));

  data = computed(() => {
    return this.signalsQuery.data()?.pages?.flat();
  });
} 