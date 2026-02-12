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
import { PersianNumberService } from '@ounce24/utils';
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
            options: { type?: string; size?: string; theme?: string }
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

  googleButtonContainer = viewChild<ElementRef<HTMLElement>>(
    'googleButtonContainer'
  );

  constructor(public languageService: LanguageService) {}

  showGoogleSignIn(): boolean {
    return !!environment.googleClientId;
  }

  ngAfterViewInit(): void {
    if (!this.showGoogleSignIn()) return;
    const tryRender = () => {
      if (window.google?.accounts?.id) {
        this.renderGoogleButton();
        return true;
      }
      return false;
    };
    if (!tryRender()) {
      const interval = setInterval(() => {
        if (tryRender()) clearInterval(interval);
      }, 100);
      setTimeout(() => clearInterval(interval), 5000);
    }
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
    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      size: 'large',
      theme: 'outline',
    });
  }

  private async handleGoogleCredential(idToken: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.googleLoginMutation.mutateAsync(idToken);
      this.analyticsService.trackEvent('login', { method: 'google' });
      const returnPath = this.route.snapshot.queryParams?.['returnPath'];
      const user = this.auth.userQuery.data();
      if (user?.name) {
        this.router.navigate([returnPath || '/'], { replaceUrl: true });
      } else {
        this.router.navigate(['/profile/edit'], {
          queryParams: this.route.snapshot.queryParams,
          replaceUrl: true,
        });
      }
    } catch {
      this.errorMessage.set('login.googleError');
    } finally {
      this.loading.set(false);
    }
  }

  async sendToken(phone: string, ev: SubmitEvent): Promise<void> {
    if (phone.length !== 10) return;
    phone = `0${PersianNumberService.toEnglish(phone)}`;
    this.loading.set(true);
    this.analyticsService.trackEvent('send_token', { phone });
    await this.auth.sendTokenMutation.mutateAsync(phone);
    this.router.navigate(['/login/otp'], {
      state: { phone },
      queryParams: this.route.snapshot.queryParams,
    });
    ev.preventDefault();
  }
}
