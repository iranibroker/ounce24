import { HttpClient } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { AuthService } from './auth.service';
import { lastValueFrom } from 'rxjs';
import { Achievement } from '@ounce24/types';
import { NewAchievementBottomSheetComponent } from '../components/new-achievement-bottom-sheet/new-achievement-bottom-sheet.component';
import { MatBottomSheet } from '@angular/material/bottom-sheet';

const LAST_CHECK_ACHIEVEMENTS_KEY = 'lastCheckAchievements';

@Injectable({
  providedIn: 'root',
})
export class AchievementService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly bottomSheet = inject(MatBottomSheet);
  userId = computed(() => this.auth.userQuery.data()?.id);
  lastCheck = signal<number>(
    localStorage.getItem(LAST_CHECK_ACHIEVEMENTS_KEY)
      ? Number(localStorage.getItem(LAST_CHECK_ACHIEVEMENTS_KEY))
      : 0,
  );

  constructor() {
    effect(() => {
      const achievements = this.achievementsQuery.data();
      const achievement = achievements?.[0];
      untracked(() => {
        if (achievement) {
          const achievementDate = new Date(achievement.createdAt).valueOf();
          if (achievementDate > this.lastCheck()) {
            setTimeout(() => {
            this.bottomSheet.open(NewAchievementBottomSheetComponent, {
                data: achievement,
              });
            }, 3000);
            localStorage.setItem(
              LAST_CHECK_ACHIEVEMENTS_KEY,
              achievementDate.toString(),
            );
          }
        }
      });
    });
  }

  achievementsQuery = injectQuery(() => ({
    queryKey: ['user-achievements', this.userId()],
    queryFn: async () => {
      return lastValueFrom(
        this.http.get<Achievement[]>(
          `/api/users/${this.userId()}/achievements`,
          {
            params: {
              limit: 1,
            },
          },
        ),
      );
    },
    refetchInterval: 10 * 1000,
    enabled: !!this.userId(),
  }));
}
