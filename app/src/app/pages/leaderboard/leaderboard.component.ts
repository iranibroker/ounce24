import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '@ounce24/types';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import { DataLoadingComponent } from '../../components/data-loading/data-loading.component';
import { RouterModule } from '@angular/router';
import { SHARED } from '../../shared';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ScoreInfoDialogComponent } from '../../components/score-info-dialog/score-info-dialog.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatIconModule,
    MatDividerModule,
    TranslateModule,
    RouterModule,
    DataLoadingComponent,
    SHARED,
    MatButtonModule,
    MatTooltipModule,
    MatToolbarModule,
  ],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss',
})
export class LeaderboardComponent {
  private readonly http = inject(HttpClient);
  private dialog = inject(MatDialog);
  public authService = inject(AuthService);

  query = injectQuery(() => ({
    queryKey: ['leaderboard', this.authService.userQuery.data()?.id],
    queryFn: () =>
      lastValueFrom(
        this.http.get<User[]>('/api/users/leaderboard', {
          params: this.authService.userQuery.data()
            ? {
                userId: this.authService.userQuery.data()?.id,
              }
            : undefined,
        }),
      ),
    refetchInterval: 30000,
  }));

  openScoreInfo(): void {
    this.dialog.open(ScoreInfoDialogComponent, {
      width: '500px',
    });
  }
}
