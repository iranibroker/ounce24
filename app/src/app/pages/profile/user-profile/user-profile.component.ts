import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxArrowLeftOutline, saxEditOutline, saxCupOutline, saxStarOutline, saxActivityOutline, saxPercentageCircleOutline, saxJudgeOutline, saxNotificationOutline, saxLogoutOutline, saxGlobalOutline } from '@ng-icons/iconsax/outline';
import { saxDiamondsBold } from '@ng-icons/iconsax/bold';
import { Component, inject, computed } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PushNotificationService } from '../../../services/push-notification.service';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { LanguageService } from '../../../services/language.service';
import { LanguageSelectionModalComponent } from '../../../components/language-selection-modal/language-selection-modal.component';
import {
  injectQuery,
  injectInfiniteQuery,
} from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Achievement, Signal } from '@ounce24/types';
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
    AchievementCardComponent,
    MatSlideToggleModule,],
  providers: [provideIcons({ saxArrowLeftOutline, saxEditOutline, saxDiamondsBold, saxCupOutline, saxStarOutline, saxActivityOutline, saxPercentageCircleOutline, saxJudgeOutline, saxNotificationOutline, saxLogoutOutline, saxGlobalOutline })],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'],
})
export class UserProfileComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly pushService = inject(PushNotificationService);
  readonly languageService = inject(LanguageService);
  private readonly dialog = inject(MatDialog);

  openLanguageSelection() {
    this.dialog.open(LanguageSelectionModalComponent, {
      width: '400px',
      maxWidth: '95vw',
    });
  }

  logout() {
    this.auth.token.set(null);
    this.router.navigate(['/login']);
  }

  async toggleNotifications(checked: boolean) {
    if (checked) {
      await this.pushService.subscribeToNotifications();
    } else {
      await this.pushService.unsubscribeFromNotifications();
    }
  }

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

  achievementsQuery = injectInfiniteQuery(() => ({
    queryKey: ['user-achievements', this.route.snapshot.params['id']],
    queryFn: async ({ pageParam }) => {
      return lastValueFrom(
        this.http.get<Achievement[]>(
          `/api/users/${this.route.snapshot.params['id'] || this.auth.userQuery.data()?.id}/achievements`,
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

  signals = computed(() => {
    return this.signalsQuery.data()?.pages?.flat();
  });

  achievements = computed(() => {
    return this.achievementsQuery.data()?.pages?.flat();
  });
}
