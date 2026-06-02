import { Component } from '@angular/core';
import { ShellComponent } from './shell/shell.component';
import { LanguageService } from './services/language.service';
import { AnalyticsService } from './services/analytics.service';
import { AchievementService } from './services/achievement.service';
import { TelegramService } from './services/telegram.service';
import { AuthService } from './services/auth.service';
import { inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { PushNotificationService } from './services/push-notification.service';
import { PushSubscriptionDialogComponent } from './components/push-subscription-dialog/push-subscription-dialog.component';

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
  private dialog = inject(MatDialog);
  private pushNotificationService = inject(PushNotificationService);

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

    // Prompt user for push notifications after 20 seconds
    setTimeout(() => {
      if (
        !this.pushNotificationService.isSubscribed() &&
        !this.pushNotificationService.hasAskedBefore()
      ) {
        const dialogRef = this.dialog.open(PushSubscriptionDialogComponent, {
          width: '400px',
          maxWidth: '95vw',
          panelClass: 'push-notification-dialog-panel',
        });

        dialogRef.afterClosed().subscribe((accept: boolean) => {
          if (accept) {
            this.pushNotificationService.subscribeToNotifications();
          } else {
            this.pushNotificationService.markAsAsked();
          }
        });
      }
    }, 20000);
  }
}
