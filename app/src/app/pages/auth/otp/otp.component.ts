import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  signal,
} from '@angular/core';
import { CommonModule, PlatformLocation } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgOtpInputComponent, NgOtpInputModule } from 'ng-otp-input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { PersianNumberService } from '@ounce24/utils';
import { SHARED } from '../../../shared';
import { AuthService } from '../../../services/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'app-otp',
  standalone: true,
  imports: [
    CommonModule,
    SHARED,
    MatInputModule,
    MatFormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    NgOtpInputModule,
    MatSnackBarModule,
    MatButtonModule,
    MatToolbarModule,
  ],
  templateUrl: './otp.component.html',
  styleUrl: './otp.component.scss',
})
export class OtpComponent implements OnDestroy {
  time = signal(60);
  phone: string;
  loading = signal(false);
  error = signal(false);
  interval?: any;
  otpFormControl = new FormControl();
  prevValue: string;
  @ViewChild(NgOtpInputComponent) inputComponent: NgOtpInputComponent;

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private location: PlatformLocation,
    private router: Router,
    private snack: MatSnackBar,
    private translate: TranslateService,
  ) {
    const phone = this.router.getCurrentNavigation()?.extras?.state?.['phone'];

    if (!phone) {
      router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    this.phone = phone;
    this.resetTimer();

    this.otpFormControl.valueChanges.subscribe((value) => {
      this.error.set(false);
      if (value.length === 4 && this.prevValue?.length !== 4)
        this.setToken(value);
      this.prevValue = value;
    });
  }

  async setToken(ev?: Event) {
    const returnPath = this.route.snapshot.queryParams?.['returnPath'];
    this.loading.set(true);
    const token = PersianNumberService.toEnglish(this.otpFormControl.value);
    try {
      await this.auth.loginMutation.mutateAsync({
        phone: this.phone,
        otp: token,
      });
      const user = this.auth.userQuery.data();
      if (user?.name) {
        window.history.go(-2);
        setTimeout(() => {
          if (returnPath) {
            this.router.navigate([returnPath]);
          }
        }, 100);
      } else {
        window.history.go(-2);
        setTimeout(() => {
          this.router.navigate(['/profile/edit'], {
            queryParams: this.route.snapshot.queryParams,
          });
        }, 100);
      }
    } catch (error) {
      this.error.set(true);
      this.snack.open(this.translate.instant('login.otpError'), '', {
        duration: 2000,
      });
      this.loading.set(false);
    }
    ev?.preventDefault?.();
  }

  resetTimer() {
    this.time.set(60);
    this.inputComponent?.setValue(null);
    this.error.set(false);
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      this.time.update((prev) => {
        if (prev > 0) return prev - 1;
        return 0;
      });
    }, 1000);
  }

  async sendTokenAgain() {
    if (!this.time()) {
      this.loading.set(true);
      await this.auth.sendTokenMutation.mutateAsync(this.phone);
      this.loading.set(false);
      this.resetTimer();
    }
  }

  ngOnDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }
}
