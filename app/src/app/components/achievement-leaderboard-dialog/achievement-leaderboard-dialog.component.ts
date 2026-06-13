import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxCrownOutline, saxStarOutline, saxCupOutline } from '@ng-icons/iconsax/outline';
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
    }),
  ],
})
export class AchievementLeaderboardDialogComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

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

  onUserClick(userId: string): void {
    this.router.navigate(['/profile', userId]);
    this.dialogRef.close();
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
