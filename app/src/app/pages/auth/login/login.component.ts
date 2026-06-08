import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxArrowLeftOutline } from '@ng-icons/iconsax/outline';
import { simpleTelegram } from '@ng-icons/simple-icons';
import {
  Component,
  ElementRef,
  inject,
  viewChild,
  OnInit,
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

declare var google: any;

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
      simpleTelegram,
    }),
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, AfterViewInit {
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  googleBtn = viewChild<ElementRef>('googleBtn');
  showGoogleLogin = environment.enableGoogleLogin;

  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private analyticsService = inject(AnalyticsService);

  constructor(public languageService: LanguageService) {}

  ngOnInit() {
    // Handle Telegram OIDC Callback if code parameter exists
    const code = this.route.snapshot.queryParams['code'];
    if (code) {
      this.handleTelegramOidcCallback(code);
    }
  }

  ngAfterViewInit() {
    if (environment.enableGoogleLogin) {
      this.initializeGoogleSignIn();
    }
  }

  initializeGoogleSignIn() {
    if (typeof google !== 'undefined' && google.accounts?.id) {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (response: any) => this.handleGoogleCredentialResponse(response),
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      const element = this.googleBtn()?.nativeElement;
      if (element) {
        google.accounts.id.renderButton(element, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 320,
        });
      }
    } else {
      // Retry if Google script is still loading
      setTimeout(() => this.initializeGoogleSignIn(), 100);
    }
  }

  async handleGoogleCredentialResponse(response: any) {
    const credential = response.credential;
    if (!credential) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.auth.googleLoginMutation.mutateAsync(credential);
      this.analyticsService.trackEvent('login', { method: 'google' });
      const returnPath = this.route.snapshot.queryParams?.['returnPath'];
      this.router.navigate([returnPath || '/'], { replaceUrl: true });
    } catch (err) {
      console.error('Google login error:', err);
      this.errorMessage.set('login.googleError');
    } finally {
      this.loading.set(false);
    }
  }

  onTelegramOidcClick(): void {
    const clientId = environment.telegramOidcClientId;
    if (!clientId) {
      this.errorMessage.set('login.telegram.error');
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    const state = Math.random().toString(36).substring(2, 15);
    const scope = encodeURIComponent('openid profile phone');
    const oidcUrl = `https://oauth.telegram.org/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
    window.location.href = oidcUrl;
  }

  private async handleTelegramOidcCallback(code: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      await this.auth.telegramOidcLoginMutation.mutateAsync({ code, redirectUri });
      this.analyticsService.trackEvent('login', { method: 'telegram_oidc' });
      const returnPath = this.route.snapshot.queryParams?.['returnPath'];
      this.router.navigate([returnPath || '/'], { replaceUrl: true });
    } catch (err) {
      console.error('Telegram OIDC login error:', err);
      this.errorMessage.set('login.telegram.error');
    } finally {
      this.loading.set(false);
    }
  }
}
