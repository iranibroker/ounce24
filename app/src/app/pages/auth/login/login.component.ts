import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  saxArrowLeftOutline,
  saxActivityOutline,
  saxCupOutline,
  saxMicrophoneOutline,
} from '@ng-icons/iconsax/outline';
import { saxDiamondsBold } from '@ng-icons/iconsax/bold';
import {
  Component,
  ElementRef,
  inject,
  viewChild,
  NgZone,
  AfterViewInit,
  OnInit,
  OnDestroy,
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

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: string;
              size?: string;
              theme?: string;
              width?: number;
              locale?: string;
            }
          ) => void;
        };
      };
    };
  }
}

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
      saxActivityOutline,
      saxCupOutline,
      saxMicrophoneOutline,
      saxDiamondsBold,
    }),
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy, AfterViewInit {
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private analyticsService = inject(AnalyticsService);
  private ngZone = inject(NgZone);

  googleButtonContainer = viewChild<ElementRef<HTMLElement>>(
    'googleButtonContainer'
  );
  telegramButtonContainer = viewChild<ElementRef<HTMLElement>>(
    'telegramButtonContainer'
  );

  // Onboarding Carousel Data
  slides = [
    {
      title: 'login.onboarding.signalsTitle',
      description: 'login.onboarding.signalsDesc',
      icon: 'saxActivityOutline',
    },
    {
      title: 'login.onboarding.aiTitle',
      description: 'login.onboarding.aiDesc',
      icon: 'saxDiamondsBold',
    },
    {
      title: 'login.onboarding.leaderboardTitle',
      description: 'login.onboarding.leaderboardDesc',
      icon: 'saxCupOutline',
    },
    {
      title: 'login.onboarding.podcastTitle',
      description: 'login.onboarding.podcastDesc',
      icon: 'saxMicrophoneOutline',
    },
  ];

  activeSlide = signal(0);
  private autoplayInterval: any;

  constructor(public languageService: LanguageService) {}

  ngOnInit() {
    this.startAutoplay();
  }

  ngOnDestroy() {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
    }
  }

  private startAutoplay() {
    this.autoplayInterval = setInterval(() => {
      this.activeSlide.update((curr) => (curr + 1) % this.slides.length);
    }, 4000);
  }

  setSlide(index: number) {
    this.activeSlide.set(index);
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
      this.startAutoplay();
    }
  }

  showGoogleSignIn(): boolean {
    return !!environment.googleClientId;
  }

  ngAfterViewInit(): void {
    if (this.showGoogleSignIn()) {
      const tryRenderGoogle = () => {
        if (window.google?.accounts?.id) {
          this.renderGoogleButton();
          return true;
        }
        return false;
      };
      if (!tryRenderGoogle()) {
        const interval = setInterval(() => {
          if (tryRenderGoogle()) clearInterval(interval);
        }, 100);
        setTimeout(() => clearInterval(interval), 5000);
      }
    }

    this.renderTelegramButton();
  }

  private renderGoogleButton(): void {
    const container = this.googleButtonContainer()?.nativeElement;
    const clientId = environment.googleClientId;
    if (!container || !clientId || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        this.ngZone.run(() => this.handleGoogleCredential(response.credential));
      },
    });
    setTimeout(() => {
      const w =
        container.clientWidth ||
        (container.parentElement?.clientWidth ?? 0) ||
        320;
      const width = Math.min(400, Math.max(200, w));
      window.google.accounts.id.renderButton(container, {
        type: 'standard',
        size: 'large',
        theme: 'outline',
        width,
        locale: 'en',
      });
    }, 0);
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

  private async handleGoogleCredential(idToken: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.googleLoginMutation.mutateAsync(idToken);
      this.analyticsService.trackEvent('login', { method: 'google' });
      const returnPath = this.route.snapshot.queryParams?.['returnPath'];
      this.router.navigate([returnPath || '/'], { replaceUrl: true });
    } catch {
      this.errorMessage.set('login.googleError');
    } finally {
      this.loading.set(false);
    }
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
