import { Component, inject, signal, OnInit, OnDestroy, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterModule, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  saxArrowLeftOutline,
  saxStarOutline,
  saxInfoCircleOutline,
  saxArrowUpOutline,
  saxArrowDownOutline,
  saxClockOutline,
  saxLockOutline,
} from '@ng-icons/iconsax/outline';
import { saxTrendUpBold, saxTrendDownBold } from '@ng-icons/iconsax/bold';
import { OuncePriceService } from '../../../services/ounce-price.service';
import { AuthService } from '../../../services/auth.service';
import { LanguageService } from '../../../services/language.service';
import { DataLoadingComponent } from '../../../components/data-loading/data-loading.component';
import { AvatarDirective } from '../../../directives/avatar.directive';
import { OctopusHistoryDialogComponent } from '../../../components/octopus-history-dialog/octopus-history-dialog.component';

function getVotingState(now: Date, cutoffHour: number): { enabled: boolean; nextTransition: Date } {
  const day = now.getUTCDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
  const timeInHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;

  let enabled = false;
  const nextTransition = new Date(now);

  if (day === 6) { // Saturday
    enabled = false;
    nextTransition.setUTCDate(now.getUTCDate() + (7 - day)); // Sunday
    nextTransition.setUTCHours(23, 0, 0, 0);
  } else if (day === 0) { // Sunday
    if (timeInHours < 23) {
      enabled = false;
      nextTransition.setUTCHours(23, 0, 0, 0);
    } else {
      enabled = true;
      nextTransition.setUTCDate(now.getUTCDate() + 1); // Monday
      const hrs = Math.floor(cutoffHour);
      const mins = Math.round((cutoffHour - hrs) * 60);
      nextTransition.setUTCHours(hrs, mins, 0, 0);
    }
  } else if (day === 5) { // Friday
    if (timeInHours < cutoffHour) {
      enabled = true;
      const hrs = Math.floor(cutoffHour);
      const mins = Math.round((cutoffHour - hrs) * 60);
      nextTransition.setUTCHours(hrs, mins, 0, 0);
    } else {
      enabled = false;
      nextTransition.setUTCDate(now.getUTCDate() + 2); // Sunday
      nextTransition.setUTCHours(23, 0, 0, 0);
    }
  } else { // Monday, Tuesday, Wednesday, Thursday
    if (timeInHours < cutoffHour) {
      enabled = true;
      const hrs = Math.floor(cutoffHour);
      const mins = Math.round((cutoffHour - hrs) * 60);
      nextTransition.setUTCHours(hrs, mins, 0, 0);
    } else if (timeInHours >= cutoffHour && timeInHours < 23) {
      enabled = false;
      nextTransition.setUTCHours(23, 0, 0, 0);
    } else { // timeInHours >= 23
      enabled = true;
      nextTransition.setUTCDate(now.getUTCDate() + 1); // tomorrow
      const hrs = Math.floor(cutoffHour);
      const mins = Math.round((cutoffHour - hrs) * 60);
      nextTransition.setUTCHours(hrs, mins, 0, 0);
    }
  }

  return { enabled, nextTransition };
}

@Component({
  selector: 'app-signals-octopus',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MatButtonModule,
    MatTabsModule,
    MatListModule,
    MatDividerModule,
    RouterModule,
    NgIcon,
    DataLoadingComponent,
    AvatarDirective,
    MatDialogModule,
    MatTooltipModule,
  ],
  providers: [
    provideIcons({
      saxArrowLeftOutline,
      saxStarOutline,
      saxInfoCircleOutline,
      saxArrowUpOutline,
      saxArrowDownOutline,
      saxClockOutline,
      saxLockOutline,
      saxTrendUpBold,
      saxTrendDownBold
    })
  ],
  templateUrl: './octopus.component.html',
  styleUrl: './octopus.component.scss'
})
export class OctopusComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly queryClient = inject(QueryClient);
  private readonly dialog = inject(MatDialog);
  
  public priceService = inject(OuncePriceService);
  public authService = inject(AuthService);
  public languageService = inject(LanguageService);
  private translate = inject(TranslateService);

  votingState = signal<{ enabled: boolean; nextTransition: Date }>({ enabled: true, nextTransition: new Date() });
  countdownText = signal<string>('00:00:00');
  get currentMonthName(): string {
    const lang = this.translate.currentLang;
    const locale = lang === 'fa' ? 'fa-IR-u-ca-gregory' :
                   lang === 'ar' ? 'ar-SA-u-ca-gregory' :
                   lang === 'tr' ? 'tr-TR' : 'en-US';
    return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date());
  }
  monthCountdown = signal<{ days: number; hours: number; minutes: number; seconds: number }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  weekCountdown = signal<{ days: number; hours: number; minutes: number; seconds: number }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  isSubmitting = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  private timer: any = null;

  weekCountdownText = computed(() => {
    const time = this.weekCountdown();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return time.days > 0
      ? `${time.days}d ${pad(time.hours)}:${pad(time.minutes)}`
      : `${pad(time.hours)}:${pad(time.minutes)}`;
  });

  monthCountdownText = computed(() => {
    const time = this.monthCountdown();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return time.days > 0
      ? `${time.days}d ${pad(time.hours)}:${pad(time.minutes)}`
      : `${pad(time.hours)}:${pad(time.minutes)}`;
  });

  constructor() {
    effect(() => {
      this.priceService.isMarketOpen();
      const user = this.authService.userQuery.data();
      const userId = user?.id || (user as any)?._id;
      this.queryClient.invalidateQueries({ queryKey: ['octopusVote', userId] });
      this.queryClient.invalidateQueries({ queryKey: ['octopusSentiment'] });
      this.queryClient.invalidateQueries({ queryKey: ['octopusScores', userId] });
    });
  }

  // Configuration query for Octopus game parameters
  configQuery = injectQuery(() => ({
    queryKey: ['octopusConfig'],
    queryFn: () => lastValueFrom(this.http.get<{ cutoffHour: number }>('/api/octopus/config')),
    staleTime: Infinity,
  }));

  cutoffHour = computed(() => this.configQuery.data()?.cutoffHour ?? 10.5);

  localCutoffTime = computed(() => {
    const hourVal = this.cutoffHour();
    const cutoffDate = new Date();
    const hours = Math.floor(hourVal);
    const minutes = Math.round((hourVal - hours) * 60);
    cutoffDate.setUTCHours(hours, minutes, 0, 0);
    return cutoffDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  });

  ngOnInit() {
    this.startCountdown();
  }

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  // Live query for user's today vote
  myVoteQuery = injectQuery(() => {
    const user = this.authService.userQuery.data();
    return {
      queryKey: ['octopusVote', user?.id],
      queryFn: () => lastValueFrom(this.http.get<any>('/api/octopus/me/vote')),
      enabled: !!user?.id,
      refetchInterval: 15000,
    };
  });

  // Live query for daily sentiment statistics
  sentimentQuery = injectQuery(() => ({
    queryKey: ['octopusSentiment'],
    queryFn: () => lastValueFrom(this.http.get<any>('/api/octopus/sentiment')),
    refetchInterval: 15000,
  }));

  // Weekly Octopus Leaderboard query
  weeklyLeaderboardQuery = injectQuery(() => ({
    queryKey: ['octopusLeaderboardWeekly'],
    queryFn: () => lastValueFrom(this.http.get<any[]>('/api/octopus/leaderboard/weekly')),
    refetchInterval: 30000,
  }));

  // Monthly Octopus Leaderboard query
  monthlyLeaderboardQuery = injectQuery(() => ({
    queryKey: ['octopusLeaderboardMonthly'],
    queryFn: () => lastValueFrom(this.http.get<any[]>('/api/octopus/leaderboard/monthly')),
    refetchInterval: 30000,
  }));

  // Total Octopus Leaderboard query
  totalLeaderboardQuery = injectQuery(() => ({
    queryKey: ['octopusLeaderboardTotal'],
    queryFn: () => lastValueFrom(this.http.get<any[]>('/api/octopus/leaderboard/total')),
    refetchInterval: 30000,
  }));

  // User's own Octopus scores (weekly, monthly, total stars)
  myScoresQuery = injectQuery(() => {
    const user = this.authService.userQuery.data();
    return {
      queryKey: ['octopusScores', user?.id],
      queryFn: () => lastValueFrom(this.http.get<any>('/api/octopus/me/scores')),
      enabled: !!user?.id,
      refetchInterval: 30000,
    };
  });



  private startCountdown() {
    this.updateCountdown();
    this.timer = setInterval(() => this.updateCountdown(), 1000);
  }

  private updateCountdown() {
    const now = new Date();
    const cutoffHour = this.cutoffHour();

    const state = getVotingState(now, cutoffHour);
    const oldEnabled = this.votingState().enabled;
    this.votingState.set(state);

    // If voting status just changed, invalidate queries to get latest backend details
    if (oldEnabled !== state.enabled) {
      const user = this.authService.userQuery.data();
      this.queryClient.invalidateQueries({ queryKey: ['octopusVote', user?.id] });
      this.queryClient.invalidateQueries({ queryKey: ['octopusSentiment'] });
    }

    const diff = state.nextTransition.getTime() - now.getTime();
    if (diff <= 0) {
      this.countdownText.set('00:00');
      return;
    }

    const totalHours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const days = Math.floor(totalHours / 24);
    const hrs = totalHours % 24;

    const pad = (n: number) => n.toString().padStart(2, '0');
    if (days > 0) {
      this.countdownText.set(`${days}d ${pad(hrs)}:${pad(mins)}`);
    } else {
      this.countdownText.set(`${pad(hrs)}:${pad(mins)}`);
    }

    // Calculate month countdown
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();
    const nextMonthStart = new Date(Date.UTC(currentYear, currentMonth + 1, 1, 0, 0, 0, 0));
    const monthDiff = nextMonthStart.getTime() - now.getTime();
    if (monthDiff <= 0) {
      this.monthCountdown.set({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    } else {
      const days = Math.floor(monthDiff / 86400000);
      const hoursLeft = Math.floor((monthDiff % 86400000) / 3600000);
      const minsLeft = Math.floor((monthDiff % 3600000) / 60000);
      const secsLeft = Math.floor((monthDiff % 60000) / 1000);
      this.monthCountdown.set({ days, hours: hoursLeft, minutes: minsLeft, seconds: secsLeft });
    }

    // Calculate week countdown (ends on Friday 17:00 America/New_York trading close)
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
      this.weekCountdown.set({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    } else {
      const days = Math.floor(weekDiff / 86400000);
      const hoursLeft = Math.floor((weekDiff % 86400000) / 3600000);
      const minsLeft = Math.floor((weekDiff % 3600000) / 60000);
      const secsLeft = Math.floor((weekDiff % 60000) / 1000);
      this.weekCountdown.set({ days, hours: hoursLeft, minutes: minsLeft, seconds: secsLeft });
    }
  }

  async submitVote(direction: 'up' | 'down') {
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);

    try {
      await lastValueFrom(this.http.post('/api/octopus/vote', { direction }));
      
      this.isEditing.set(false);
      // Update success feedback
      const msg = await lastValueFrom(this.translate.get('octopus.success'));
      this.snackBar.open(msg, '', { duration: 3000 });

      // Invalidate queries to reload updated state
      const user = this.authService.userQuery.data();
      this.queryClient.invalidateQueries({ queryKey: ['octopusVote', user?.id] });
      this.queryClient.invalidateQueries({ queryKey: ['octopusSentiment'] });
      this.queryClient.invalidateQueries({ queryKey: ['octopusScores', user?.id] });
      this.queryClient.invalidateQueries({ queryKey: ['octopusHistory', user?.id] });
      this.queryClient.invalidateQueries({ queryKey: ['octopusLeaderboardWeekly'] });
      this.queryClient.invalidateQueries({ queryKey: ['octopusLeaderboardMonthly'] });
      this.queryClient.invalidateQueries({ queryKey: ['octopusLeaderboardTotal'] });
    } catch (err: any) {
      const errMsg = err?.error?.message || 'Failed to submit prediction';
      this.snackBar.open(errMsg, '', { duration: 3000 });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  goBack() {
    this.router.navigate(['/leaderboard']);
  }

  openHistoryDialog() {
    this.dialog.open(OctopusHistoryDialogComponent, {
      width: '450px',
      maxWidth: '95vw',
    });
  }

  mapToUserShape(entry: any): any {
    return {
      id: entry.userId,
      avatar: entry.avatar,
      name: entry.name,
      title: entry.title
    };
  }
}
