import { Component } from '@angular/core';
import { ShellComponent } from './shell/shell.component';
import { LanguageService } from './services/language.service';
import { AnalyticsService } from './services/analytics.service';
import { AchievementService } from './services/achievement.service';
import { TelegramService } from './services/telegram.service';
import { AuthService } from './services/auth.service';
import { inject, OnInit, OnDestroy, effect } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { PwaService } from './services/pwa.service';
import { PwaInstallDialogComponent } from './components/pwa-install-dialog/pwa-install-dialog.component';
import { LanguageSelectionModalComponent } from './components/language-selection-modal/language-selection-modal.component';

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
  private languageDialogRef: any = null;

  constructor(
    private languageService: LanguageService,
    private analyticsService: AnalyticsService,
    private achievementService: AchievementService,
  ) {
    // Language service will handle initialization
    // This ensures RTL is set correctly on app startup

    const authService = inject(AuthService);
    effect(() => {
      const user = authService.userQuery.data();
      if (user && user.language) {
        if (this.languageDialogRef) {
          this.languageDialogRef.close();
          this.languageDialogRef = null;
        }
      }
    });
  }

  ngOnInit() {
    // Check onboarding status
    const onboarded = localStorage.getItem('ounce24_onboarded');
    this.showOnboarding = onboarded !== 'true';

    // If no language has been explicitly selected yet, open the language selection modal
    if (!this.languageService.hasExplicitLanguageSelection()) {
      setTimeout(() => {
        this.showLanguageSelectionModal();
      });
    }

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
    localStorage.setItem('ounce24_needs_tour', 'true');
    this.showOnboarding = false;
  }

  checkAndStartPushTimer() {
    // Automatic PWA prompt is disabled to prevent clashing with the App Guide.
    // Installation is triggered manually from the menu.
  }

  showLanguageSelectionModal() {
    this.languageDialogRef = this.dialog.open(LanguageSelectionModalComponent, {
      width: '400px',
      maxWidth: '95vw',
      panelClass: 'language-dialog-panel',
      disableClose: true,
    });
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
