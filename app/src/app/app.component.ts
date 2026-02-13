import { Component } from '@angular/core';
import { ShellComponent } from './shell/shell.component';
import { LanguageService } from './services/language.service';
import { AnalyticsService } from './services/analytics.service';
import { AchievementService } from './services/achievement.service';
import { TelegramService } from './services/telegram.service';
import { AuthService } from './services/auth.service';
import { inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  imports: [ShellComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'app';
  private telegramService = inject(TelegramService);
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor(
    private languageService: LanguageService,
    private analyticsService: AnalyticsService,
    private achievementService: AchievementService,
  ) {
    // Language service will handle initialization
    // This ensures RTL is set correctly on app startup
  }

  ngOnInit() {
    // Always re-authenticate when in Telegram Mini App - user may have switched
    // accounts; localStorage would still have the previous JWT otherwise.
    if (this.telegramService.isTelegramApp) {
      this.authService.telegramLoginMutation.mutate(this.telegramService.initData, {
        onSuccess: () => {
          // Reload or navigate to refresh state if needed, but auth service should handle token
          // Maybe redirect to home if on login page?
          // For now, just let the state update.
        },
        onError: (error) => {
          console.error('Telegram login failed', error);
        }
      });
    }
  }
}
