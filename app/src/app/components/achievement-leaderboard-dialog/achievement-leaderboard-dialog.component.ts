import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxCrownOutline, saxStarOutline, saxCupOutline } from '@ng-icons/iconsax/outline';
import { saxDiamondsBold } from '@ng-icons/iconsax/bold';
import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { SHARED } from '../../shared';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import { AchievementType } from '@ounce24/types';
import { Router } from '@angular/router';
import { DataLoadingComponent } from '../data-loading/data-loading.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
  selector: 'app-achievement-leaderboard-dialog',
  templateUrl: './achievement-leaderboard-dialog.component.html',
  styleUrls: ['./achievement-leaderboard-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    SHARED,
    NgIcon,
    DataLoadingComponent,
    EmptyStateComponent,
  ],
  providers: [
    provideIcons({
      saxCrownOutline,
      saxStarOutline,
      saxCupOutline,
      saxDiamondsBold,
    }),
  ],
})
export class AchievementLeaderboardDialogComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly rewardMap: Record<AchievementType, number> = {
    [AchievementType.WeekWin]: 30,
    [AchievementType.MonthWin]: 100,
    [AchievementType.BestSignalWeek]: 10,
    [AchievementType.BestSignalMonth]: 40,
    [AchievementType.Hatrik20Points]: 30,
    [AchievementType.FiftyPoint]: 30,
    [AchievementType.FiveStreakR1]: 30,
    [AchievementType.Winrate60In30]: 50,
    [AchievementType.OctopusWeekWin]: 10,
    [AchievementType.OctopusMonthWin]: 30,
    [AchievementType.Octopus5Streak]: 20,
    [AchievementType.Octopus10Streak]: 100,
  };

  constructor(
    public dialogRef: MatDialogRef<AchievementLeaderboardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { type: AchievementType },
  ) {}

  leaderboardQuery = injectQuery(() => ({
    queryKey: ['achievement-leaderboard', this.data.type],
    queryFn: () =>
      lastValueFrom(
        this.http.get<any[]>(`/api/users/leaderboard/achievement/${this.data.type}`),
      ),
  }));

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

  onUserClick(userId: string): void {
    this.router.navigate(['/profile', userId]);
    this.dialogRef.close();
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
