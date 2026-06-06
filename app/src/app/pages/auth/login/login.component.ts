import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxArrowLeftOutline } from '@ng-icons/iconsax/outline';
import {
  Component,
  ElementRef,
  inject,
  viewChild,
  NgZone,
  AfterViewInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { SHARED } from '../../../shared';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AnalyticsService } from '../../../services/analytics.service';
import { LanguageService } from '../../../services/language.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule,
    MatProgressSpinnerModule,
    SHARED,
    MatButtonModule,
    MatToolbarModule,
    NgIcon,
  ],
  providers: [
    provideIcons({
      saxArrowLeftOutline,
    }),
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements AfterViewInit {
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private analyticsService = inject(AnalyticsService);
  private ngZone = inject(NgZone);

  telegramButtonContainer = viewChild<ElementRef<HTMLElement>>(
    'telegramButtonContainer'
  );

  constructor(public languageService: LanguageService) {}

  ngAfterViewInit(): void {
    this.renderTelegramButton();
  }

  private renderTelegramButton(): void {
    const container = this.telegramButtonContainer()?.nativeElement;
    const botName = environment.telegramBotName;
    if (!container || !botName) return;

    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    (window as any).onTelegramAuth = (user: any) => {
      this.ngZone.run(() => this.handleTelegramWidgetAuth(user));
    };

    container.appendChild(script);
  }

  private async handleTelegramWidgetAuth(user: any): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.telegramWidgetLoginMutation.mutateAsync(user);
      this.analyticsService.trackEvent('login', { method: 'telegram_widget' });
      const returnPath = this.route.snapshot.queryParams?.['returnPath'];
      this.router.navigate([returnPath || '/'], { replaceUrl: true });
    } catch {
      this.errorMessage.set('login.telegram.error');
    } finally {
      this.loading.set(false);
    }
  }
}
