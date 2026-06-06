import { Component } from '@angular/core';
import { ShellComponent } from './shell/shell.component';
import { LanguageService } from './services/language.service';
import { AnalyticsService } from './services/analytics.service';
import { AchievementService } from './services/achievement.service';
import { TelegramService } from './services/telegram.service';
import { AuthService } from './services/auth.service';
import { inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { PwaService } from './services/pwa.service';
import { PwaInstallDialogComponent } from './components/pwa-install-dialog/pwa-install-dialog.component';

import { OnboardingComponent } from './components/onboarding/onboarding.component';

@Component({
  imports: [ShellComponent, OnboardingComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'app';
  showOnboarding = false;
  private telegramService = inject(TelegramService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private pwaService = inject(PwaService);
  private pushTimer: any = null;
  private routerSubscription: any = null;

  constructor(
    private languageService: LanguageService,
    private analyticsService: AnalyticsService,
    private achievementService: AchievementService,
  ) {
    // Language service will handle initialization
    // This ensures RTL is set correctly on app startup
  }

  ngOnInit() {
    // Check onboarding status
    const onboarded = localStorage.getItem('ounce24_onboarded');
    this.showOnboarding = onboarded !== 'true';

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

    // Check and start push prompt timer on navigation changes (handles post-login redirects)
    this.routerSubscription = this.router.events.subscribe(() => {
      this.checkAndStartPushTimer();
    });
    // Trigger initial check in case user is already logged in on startup
    this.checkAndStartPushTimer();
  }

  onOnboardingComplete() {
    localStorage.setItem('ounce24_onboarded', 'true');
    this.showOnboarding = false;
  }

  checkAndStartPushTimer() {
    const isLoggedIn = !!this.authService.token();
    const isLoginPage = this.router.url.includes('/login');

    if (isLoggedIn && !isLoginPage) {
      if (
        !this.pushTimer &&
        this.pwaService.isPwaSupported() &&
        !this.pwaService.hasAskedBefore()
      ) {
        this.pushTimer = setTimeout(() => {
          this.showPwaInstallPrompt();
        }, 20000);
      }
    } else {
      if (this.pushTimer) {
        clearTimeout(this.pushTimer);
        this.pushTimer = null;
      }
    }
  }

  showPwaInstallPrompt() {
    const dialogRef = this.dialog.open(PwaInstallDialogComponent, {
      width: '400px',
      maxWidth: '95vw',
      panelClass: 'push-notification-dialog-panel',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((accept: boolean) => {
      this.pwaService.markAsAsked();
      if (accept) {
        this.pwaService.install();
      }
    });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
    }
  }
}
