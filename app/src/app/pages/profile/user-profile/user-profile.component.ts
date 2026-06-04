import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxArrowLeftOutline, saxEditOutline, saxCupOutline, saxStarOutline, saxActivityOutline, saxPercentageCircleOutline, saxJudgeOutline, saxCalendarOutline } from '@ng-icons/iconsax/outline';
import { saxDiamondsBold } from '@ng-icons/iconsax/bold';
import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { injectQuery, injectInfiniteQuery } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Achievement, AchievementType, Signal } from '@ounce24/types';
import { SignalCardComponent } from '../../../components/signal-card/signal-card.component';
import { DataLoadingComponent } from '../../../components/data-loading/data-loading.component';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { Location } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { SHARED } from '../../../shared';
import { MatTabsModule } from '@angular/material/tabs';
import { AchievementCardComponent } from '../../../components/achievement-card/achievement-card.component';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [NgIcon, CommonModule,
    MatCardModule,
    MatDividerModule,
    MatButtonModule,
    MatToolbarModule,
    RouterModule,
    TranslateModule,
    SignalCardComponent,
    DataLoadingComponent,
    EmptyStateComponent,
    MatTabsModule,
    SHARED,
  ],
  providers: [provideIcons({ saxArrowLeftOutline, saxEditOutline, saxDiamondsBold, saxCupOutline, saxStarOutline, saxActivityOutline, saxPercentageCircleOutline, saxJudgeOutline, saxCalendarOutline })],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'],
})
export class UserProfileComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly auth = inject(AuthService);

  isOwnProfile = computed(() => {
    const currentUser = this.auth.userQuery.data();
    const profileId = this.route.snapshot.params['id'];
    return !profileId || currentUser?.id === profileId;
  });

  userQuery = injectQuery(() => ({
    queryKey: ['user', this.route.snapshot.params['id']],
    queryFn: () =>
      lastValueFrom(
        this.http.get<any>(
          `/api/users/${this.route.snapshot.params['id'] || this.auth.userQuery.data()?.id}`,
        ),
      ),
  }));

  signalsQuery = injectInfiniteQuery(() => ({
    queryKey: ['user-signals', this.route.snapshot.params['id']],
    queryFn: async ({ pageParam }) => {
      return lastValueFrom(
        this.http.get<Signal[]>(
          `/api/users/${this.route.snapshot.params['id'] || this.auth.userQuery.data()?.id}/signals`,
          {
            params: {
              page: pageParam,
            },
          },
        ),
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPageData, allPages, lastPage) =>
      lastPageData.length === PAGE_SIZE ? lastPage + 1 : null,
  }));

  achievementsQuery = injectQuery(() => ({
    queryKey: ['user-achievements-all', this.route.snapshot.params['id']],
    queryFn: async () => {
      return lastValueFrom(
        this.http.get<Achievement[]>(
          `/api/users/${this.route.snapshot.params['id'] || this.auth.userQuery.data()?.id}/achievements`,
          {
            params: {
              limit: 1000,
            },
          },
        ),
      );
    },
  }));

  signals = computed(() => {
    return this.signalsQuery.data()?.pages?.flat();
  });

  achievements = computed(() => {
    return this.achievementsQuery.data() || [];
  });

  AchievementType = AchievementType;

  competitionAchievements = [
    AchievementType.WeekWin,
    AchievementType.MonthWin,
    AchievementType.BestSignalWeek,
    AchievementType.BestSignalMonth,
  ];

  individualAchievements = [
    AchievementType.Hatrik20Points,
    AchievementType.FiftyPoint,
    AchievementType.FiveStreakR1,
    AchievementType.Winrate60In30,
  ];

  octopusAchievements = [
    AchievementType.OctopusWeekWin,
    AchievementType.OctopusMonthWin,
    AchievementType.Octopus5Streak,
    AchievementType.Octopus10Streak,
  ];

  achievementsSummary = computed(() => {
    const list = this.achievements();
    const counts: Record<string, number> = {};
    for (const a of list) {
      counts[a.type] = (counts[a.type] || 0) + 1;
    }
    return counts;
  });
}
