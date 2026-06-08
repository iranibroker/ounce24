import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxInfoCircleOutline } from '@ng-icons/iconsax/outline';
import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '@ounce24/types';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { SHARED } from '../../shared';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ScoreInfoDialogComponent } from '../../components/score-info-dialog/score-info-dialog.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../services/auth.service';
import { MatTabsModule } from '@angular/material/tabs';
import { LeaderboardTableComponent } from './table/table.component';
import { OctopusBannerComponent } from '../../components/octopus-banner/octopus-banner.component';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    RouterModule,
    SHARED,
    MatButtonModule,
    MatTooltipModule,
    MatToolbarModule,
    MatTabsModule,
    LeaderboardTableComponent,
    NgIcon,
    OctopusBannerComponent
  ],
  providers: [provideIcons({ saxInfoCircleOutline })],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss',
})
export class LeaderboardComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private dialog = inject(MatDialog);
  public authService = inject(AuthService);
  public translate = inject(TranslateService);

  get currentMonthName(): string {
    return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date());
  }

  monthCountdownText = signal<string>('');
  weekCountdownText = signal<string>('');
  private timer: any = null;

  ngOnInit() {
    this.updateCountdowns();
    this.timer = setInterval(() => this.updateCountdowns(), 60000);
  }

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private updateCountdowns() {
    const now = new Date();
    
    // Monthly Countdown
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();
    const nextMonthStart = new Date(Date.UTC(currentYear, currentMonth + 1, 1, 0, 0, 0, 0));
    const monthDiff = nextMonthStart.getTime() - now.getTime();
    if (monthDiff <= 0) {
      this.monthCountdownText.set('0d 0h 0m');
    } else {
      const days = Math.floor(monthDiff / 86400000);
      const hrs = Math.floor((monthDiff % 86400000) / 3600000);
      const mins = Math.floor((monthDiff % 3600000) / 60000);
      this.monthCountdownText.set(`${days}d ${hrs}h ${mins}m`);
    }

    // Weekly Countdown (ends on Friday 17:00 America/New_York trading close)
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
    const nyYear = partVal('year');
    const nyMonth = partVal('month') - 1; // 0-indexed
    const nyDay = partVal('day');

    const nyWeekdayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short'
    }).format(now);
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const nyDayOfWeek = weekdays.indexOf(nyWeekdayStr);

    const diffDays = 5 - nyDayOfWeek;
    // Base guess: Friday at 22:00 UTC (which is 17:00 EST / UTC-5)
    const targetDate = new Date(Date.UTC(nyYear, nyMonth, nyDay + diffDays, 22, 0, 0, 0));
    
    // Adjust based on the actual New York hour to handle Daylight Saving Time (EDT vs EST)
    const targetNYHour = parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false
    }).format(targetDate), 10);

    targetDate.setUTCHours(22 + (17 - targetNYHour));

    const weekDiff = targetDate.getTime() - now.getTime();
    if (weekDiff <= 0) {
      this.weekCountdownText.set('0d 0h 0m');
    } else {
      const days = Math.floor(weekDiff / 86400000);
      const hrs = Math.floor((weekDiff % 86400000) / 3600000);
      const mins = Math.floor((weekDiff % 3600000) / 60000);
      this.weekCountdownText.set(`${days}d ${hrs}h ${mins}m`);
    }
  }

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

  queryWeek = injectQuery(() => ({
    queryKey: ['leaderboardWeek', this.authService.userQuery.data()?.id],
    queryFn: () =>
      lastValueFrom(
        this.http.get<User[]>('/api/users/leaderboard/week', {
          params: this.authService.userQuery.data()
            ? {
                userId: this.authService.userQuery.data()?.id,
              }
            : undefined,
        }),
      ),
    refetchInterval: 30000,
  }));

  queryMonth = injectQuery(() => ({
    queryKey: ['leaderboardMonth', this.authService.userQuery.data()?.id],
    queryFn: () =>
      lastValueFrom(
        this.http.get<User[]>('/api/users/leaderboard/month', {
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
