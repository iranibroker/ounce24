import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxArrowLeftOutline } from '@ng-icons/iconsax/outline';
import { Component, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../services/auth.service';
import { injectMutation } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { User, TradingStyle, RiskTolerance } from '@ounce24/types';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router';
import { SHARED } from '../../../shared';

@Component({
  selector: 'app-ai-settings',
  standalone: true,
  imports: [
    NgIcon,
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatSnackBarModule,
    TranslateModule,
    MatToolbarModule,
    SHARED,
  ],
  providers: [provideIcons({ saxArrowLeftOutline })],
  templateUrl: './ai-settings.component.html',
  styleUrls: ['./ai-settings.component.scss'],
})
export class AiSettingsComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  form: FormGroup;
  
  TradingStyle = TradingStyle;
  RiskTolerance = RiskTolerance;

  private updateSettingsMutation = injectMutation<User, Error, Partial<User>>(() => ({
    mutationFn: (body) =>
      this.http.patch<User>('/api/auth/me', body).toPromise(),
    onSuccess: () => {
      this.snack.open(this.translate.instant('aiSettings.saveSuccess'), '', {
        duration: 2000,
      });
      this.loading.set(false);
    },
    onError: () => {
      this.snack.open(this.translate.instant('profile.edit.error'), '', {
        duration: 2000,
      });
      this.loading.set(false);
    },
  }));

  constructor() {
    this.form = this.fb.group({
      tradingStyle: [TradingStyle.Day, Validators.required],
      riskTolerance: [RiskTolerance.Moderate, Validators.required],
    });

    effect(() => {
      const user = this.auth.userQuery.data();
      if (user) {
        this.form.patchValue({
          tradingStyle: user.tradingStyle ?? TradingStyle.Day,
          riskTolerance: user.riskTolerance ?? RiskTolerance.Moderate,
        });
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (!this.form.valid) return;
    this.loading.set(true);
    try {
      await this.updateSettingsMutation.mutateAsync(this.form.value);
      await this.auth.userQuery.refetch();
      this.router.navigate(['/menu']);
    } catch {
      this.loading.set(false);
    }
  }
}
