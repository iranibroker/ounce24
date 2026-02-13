import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { TelegramService } from '../../../services/telegram.service';
import { SHARED } from '../../../shared';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';

@Component({
  selector: 'app-telegram',
  imports: [CommonModule, SHARED, EmptyStateComponent],
  templateUrl: './telegram.component.html',
  styleUrl: './telegram.component.scss',
})
export class TelegramComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private telegramService = inject(TelegramService);

  loading = signal(true);
  error = signal(false);

  ngOnInit() {
    const returnPath =
      this.route.snapshot.queryParams['returnPath'] || '/';

    if (this.telegramService.isTelegramApp && this.telegramService.initData) {
      this.loginWithTelegramData(returnPath);
    } else {
      this.router.navigate(['/login'], {
        queryParamsHandling: 'preserve',
      });
      this.loading.set(false);
    }
  }

  private async loginWithTelegramData(returnPath: string) {
    // Always re-authenticate with current initData - when user switches Telegram
    // accounts, localStorage still has the previous JWT, so we must not skip login.
    try {
      await this.auth.telegramLoginMutation.mutateAsync(
        this.telegramService.initData
      );
      this.router.navigateByUrl(returnPath);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
