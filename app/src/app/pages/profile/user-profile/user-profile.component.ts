import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxArrowLeftOutline, saxEditOutline, saxCupOutline, saxStarOutline, saxActivityOutline, saxPercentageCircleOutline, saxJudgeOutline, saxCalendarOutline } from '@ng-icons/iconsax/outline';
import { saxDiamondsBold } from '@ng-icons/iconsax/bold';
import { 
  lucideTrophy, 
  lucideCrown, 
  lucideAward, 
  lucideTrendingUp, 
  lucideZap, 
  lucideFlame, 
  lucideTarget, 
  lucideBadgeCheck, 
  lucideActivity 
} from '@ng-icons/lucide';
import { Component, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AchievementLeaderboardDialogComponent } from '../../../components/achievement-leaderboard-dialog/achievement-leaderboard-dialog.component';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [NgIcon, CommonModule,
    MatCardModule,
    MatDividerModule,
    MatButtonModule,
    MatToolbarModule,
    MatTooltipModule,
    RouterModule,
    TranslateModule,
    SignalCardComponent,
    DataLoadingComponent,
    EmptyStateComponent,
    MatTabsModule,
    SHARED,
    MatDialogModule,
  ],
  providers: [provideIcons({ 
    saxArrowLeftOutline, 
    saxEditOutline, 
    saxDiamondsBold, 
    saxCupOutline, 
    saxStarOutline, 
    saxActivityOutline, 
    saxPercentageCircleOutline, 
    saxJudgeOutline, 
    saxCalendarOutline,
    lucideTrophy,
    lucideCrown,
    lucideAward,
    lucideTrendingUp,
    lucideZap,
    lucideFlame,
    lucideTarget,
    lucideBadgeCheck,
    lucideActivity
  })],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'],
})
export class UserProfileComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);

  private readonly routeParams = toSignal(this.route.params);
  
  readonly userId = computed(() => {
    const params = this.routeParams();
    return params ? params['id'] : undefined;
  });

  isOwnProfile = computed(() => {
    const currentUser = this.auth.userQuery.data();
    const id = this.userId();
    return !id || currentUser?.id === id;
  });

  getRelativeJoinedDate(dateStr: string): string {
    if (!dateStr) return '';
    const created = new Date(dateStr);
    const now = new Date();
    
    created.setHours(0,0,0,0);
    const today = new Date(now);
    today.setHours(0,0,0,0);
    
    const diffTime = today.getTime() - created.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const isFa = this.translate.currentLang === 'fa';

    if (diffDays <= 0) {
      return isFa ? 'عضویت: امروز' : 'Joined: Today';
    }
    if (diffDays === 1) {
      return isFa ? 'عضویت: دیروز' : 'Joined: Yesterday';
    }
    if (diffDays < 30) {
      return isFa ? `عضویت: ${diffDays} روز پیش` : `Joined: ${diffDays}d ago`;
    }
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      return isFa ? `عضویت: ${diffMonths} ماه پیش` : `Joined: ${diffMonths}mo ago`;
    }
    const diffYears = Math.floor(diffMonths / 12);
    return isFa ? `عضویت: ${diffYears} سال پیش` : `Joined: ${diffYears}yr ago`;
  }

  getAbsoluteJoinedDate(dateStr: string): string {
    if (!dateStr) return '';
    const created = new Date(dateStr);
    const dateFormatted = created.toLocaleDateString(
      this.translate.currentLang === 'fa' ? 'fa-IR' : 'en-US',
      { year: 'numeric', month: '2-digit', day: '2-digit' }
    );
    const prefix = this.translate.currentLang === 'fa' ? 'تاریخ عضویت: ' : 'Joined: ';
    return `${prefix}${dateFormatted}`;
  }

  userQuery = injectQuery(() => {
    const id = this.userId() || this.auth.userQuery.data()?.id;
    return {
      queryKey: ['user', id],
      queryFn: () =>
        lastValueFrom(
          this.http.get<any>(
            `/api/users/${id}`,
          ),
        ),
      enabled: !!id,
    };
  });

  signalsQuery = injectInfiniteQuery(() => {
    const id = this.userId() || this.auth.userQuery.data()?.id;
    return {
      queryKey: ['user-signals', id],
      queryFn: async ({ pageParam }) => {
        return lastValueFrom(
          this.http.get<Signal[]>(
            `/api/users/${id}/signals`,
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
      enabled: !!id,
    };
  });

  achievementsQuery = injectQuery(() => {
    const id = this.userId() || this.auth.userQuery.data()?.id;
    return {
      queryKey: ['user-achievements-all', id],
      queryFn: async () => {
        return lastValueFrom(
          this.http.get<Achievement[]>(
            `/api/users/${id}/achievements`,
            {
              params: {
                limit: 1000,
              },
            },
          ),
        );
      },
      enabled: !!id,
    };
  });

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

  getAchievementIcon(type: AchievementType): string {
    switch (type) {
      case AchievementType.WeekWin:
        return 'lucideCrown';
      case AchievementType.MonthWin:
        return 'lucideTrophy';
      case AchievementType.BestSignalWeek:
        return 'lucideTrendingUp';
      case AchievementType.BestSignalMonth:
        return 'lucideZap';
      case AchievementType.Hatrik20Points:
        return 'lucideFlame';
      case AchievementType.FiftyPoint:
        return 'lucideTarget';
      case AchievementType.FiveStreakR1:
        return 'lucideBadgeCheck';
      case AchievementType.Winrate60In30:
        return 'lucideActivity';
      case AchievementType.OctopusWeekWin:
        return 'lucideCrown';
      case AchievementType.OctopusMonthWin:
        return 'lucideTrophy';
      case AchievementType.Octopus5Streak:
        return 'lucideFlame';
      case AchievementType.Octopus10Streak:
        return 'lucideZap';
      default:
        return 'lucideAward';
    }
  }

  getAchievementClass(type: AchievementType): string {
    switch (type) {
      case AchievementType.WeekWin:
      case AchievementType.MonthWin:
      case AchievementType.BestSignalWeek:
      case AchievementType.BestSignalMonth:
        return 'gold-achievement';
      case AchievementType.OctopusWeekWin:
      case AchievementType.OctopusMonthWin:
      case AchievementType.Octopus5Streak:
      case AchievementType.Octopus10Streak:
        return 'purple-achievement';
      case AchievementType.FiftyPoint:
      case AchievementType.Winrate60In30:
        return 'blue-achievement';
      case AchievementType.Hatrik20Points:
        return 'orange-achievement';
      case AchievementType.FiveStreakR1:
        return 'green-achievement';
      default:
        return 'gold-achievement';
    }
  }

  toggleFollow() {
    const user = this.userQuery.data();
    if (!user) return;
    const isFollowing = user.isFollowing;
    const url = `/api/users/${user.id}/${isFollowing ? 'unfollow' : 'follow'}`;
    this.http.post(url, {}).subscribe({
      next: () => {
        this.userQuery.refetch();
      }
    });
  }

  openAchievementLeaderboard(type: AchievementType): void {
    this.dialog.open(AchievementLeaderboardDialogComponent, {
      data: { type },
      width: '400px',
      maxWidth: '95vw',
      panelClass: 'achievement-leaderboard-dialog-panel',
    });
  }
}
