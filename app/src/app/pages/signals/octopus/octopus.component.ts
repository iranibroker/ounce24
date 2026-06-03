import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
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
import {
  saxArrowLeftOutline,
  saxStarOutline,
  saxInfoCircleOutline,
  saxArrowUpOutline,
  saxArrowDownOutline,
} from '@ng-icons/iconsax/outline';
import { saxTrendUpBold, saxTrendDownBold } from '@ng-icons/iconsax/bold';
import { OuncePriceService } from '../../../services/ounce-price.service';
import { AuthService } from '../../../services/auth.service';
import { LanguageService } from '../../../services/language.service';
import { DataLoadingComponent } from '../../../components/data-loading/data-loading.component';
import { AvatarDirective } from '../../../directives/avatar.directive';

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
    AvatarDirective
  ],
  providers: [
    provideIcons({
      saxArrowLeftOutline,
      saxStarOutline,
      saxInfoCircleOutline,
      saxArrowUpOutline,
      saxArrowDownOutline,
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
  
  public priceService = inject(OuncePriceService);
  public authService = inject(AuthService);
  public languageService = inject(LanguageService);
  private translate = inject(TranslateService);

  countdownText = signal<string>('00:00:00');
  isSubmitting = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  private timer: any = null;

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

    const cutoff = new Date(now);
    const hours = Math.floor(cutoffHour);
    const minutes = Math.round((cutoffHour - hours) * 60);
    cutoff.setUTCHours(hours, minutes, 0, 0);

    let diff = cutoff.getTime() - now.getTime();
    if (diff < 0) {
      cutoff.setUTCDate(cutoff.getUTCDate() + 1);
      diff = cutoff.getTime() - now.getTime();
    }

    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    const pad = (n: number) => n.toString().padStart(2, '0');
    this.countdownText.set(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
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
      this.queryClient.invalidateQueries({ queryKey: ['octopusLeaderboardWeekly'] });
      this.queryClient.invalidateQueries({ queryKey: ['octopusLeaderboardTotal'] });
    } catch (err: any) {
      const errMsg = err?.error?.message || 'Failed to submit prediction';
      this.snackBar.open(errMsg, '', { duration: 3000 });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  goBack() {
    this.router.navigate(['/signals']);
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
