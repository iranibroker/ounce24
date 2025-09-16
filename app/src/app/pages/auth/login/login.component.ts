import { Component, signal } from '@angular/core';
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
export class LoginComponent {
  loading = signal(false);

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private analyticsService: AnalyticsService,
  ) {}

  async sendToken(phone: string, ev: SubmitEvent) {
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
