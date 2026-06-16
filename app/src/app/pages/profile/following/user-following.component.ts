import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { injectInfiniteQuery } from '@tanstack/angular-query-experimental';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxArrowLeftOutline } from '@ng-icons/iconsax/outline';
import { AuthService } from '../../../services/auth.service';
import { SHARED } from '../../../shared';
import { DataLoadingComponent } from '../../../components/data-loading/data-loading.component';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-user-following',
  standalone: true,
  imports: [
    NgIcon,
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatToolbarModule,
    MatCardModule,
    MatTabsModule,
    TranslateModule,
    SHARED,
    DataLoadingComponent,
    EmptyStateComponent,
  ],
  providers: [provideIcons({ saxArrowLeftOutline })],
  templateUrl: './user-following.component.html',
  styleUrls: ['./user-following.component.scss'],
})
export class UserFollowingComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  activeTabIndex = 0; // 0 = followers, 1 = following
  loadingUserIds = signal<Set<string>>(new Set());

  targetUserId = computed(() => {
    return this.route.snapshot.params['id'] || this.auth.userQuery.data()?.id;
  });

  followingQuery = injectInfiniteQuery(() => ({
    queryKey: ['user-following', this.targetUserId()],
    queryFn: async ({ pageParam }) => {
      const userId = this.targetUserId();
      if (!userId) return [];
      return lastValueFrom(
        this.http.get<any[]>(`/api/users/${userId}/following`, {
          params: {
            page: pageParam,
            limit: PAGE_SIZE,
          },
        }),
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPageData, allPages, lastPage) =>
      lastPageData.length === PAGE_SIZE ? lastPage + 1 : null,
  }));

  followersQuery = injectInfiniteQuery(() => ({
    queryKey: ['user-followers', this.targetUserId()],
    queryFn: async ({ pageParam }) => {
      const userId = this.targetUserId();
      if (!userId) return [];
      return lastValueFrom(
        this.http.get<any[]>(`/api/users/${userId}/followers`, {
          params: {
            page: pageParam,
            limit: PAGE_SIZE,
          },
        }),
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPageData, allPages, lastPage) =>
      lastPageData.length === PAGE_SIZE ? lastPage + 1 : null,
  }));

  followings = computed(() => {
    return this.followingQuery.data()?.pages?.flat() || [];
  });

  followers = computed(() => {
    return this.followersQuery.data()?.pages?.flat() || [];
  });

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'following') {
        this.activeTabIndex = 1;
      } else {
        this.activeTabIndex = 0;
      }
    });
  }

  onTabChange(index: number) {
    this.activeTabIndex = index;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: index === 1 ? 'following' : 'followers' },
      queryParamsHandling: 'merge',
    });
  }

  toggleFollow(user: any) {
    const userId = user.id || user._id;
    if (!userId || this.loadingUserIds().has(userId)) return;
    this.loadingUserIds.update(set => {
      const next = new Set(set);
      next.add(userId);
      return next;
    });
    const isFollowing = user.isFollowing;
    const endpoint = `/api/users/${userId}/${isFollowing ? 'unfollow' : 'follow'}`;
    this.http.post(endpoint, {}).subscribe({
      next: () => {
        Promise.all([
          this.followingQuery.refetch(),
          this.followersQuery.refetch(),
          this.auth.userQuery.refetch()
        ]).then(() => {
          this.loadingUserIds.update(set => {
            const next = new Set(set);
            next.delete(userId);
            return next;
          });
        }).catch(() => {
          this.loadingUserIds.update(set => {
            const next = new Set(set);
            next.delete(userId);
            return next;
          });
        });
      },
      error: () => {
        this.loadingUserIds.update(set => {
          const next = new Set(set);
          next.delete(userId);
          return next;
        });
      }
    });
  }
}
