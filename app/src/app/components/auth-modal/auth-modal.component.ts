import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { signal } from '@angular/core';
import { DataLoadingComponent } from '../data-loading/data-loading.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    DataLoadingComponent,
    MatProgressBarModule,
  ],
  templateUrl: './auth-modal.component.html',
  styleUrls: ['./auth-modal.component.scss'],
})
export class AuthModalComponent {
  private bottomSheetRef = inject(MatBottomSheetRef);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  // Signals
  currentStep = signal<'phone' | 'otp'>('phone');
  timer = signal(60);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  // Forms
  phoneForm = this.fb.group({
    phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
  });

  otpForm = this.fb.group({
    otp: ['', [Validators.required, Validators.pattern('^[0-9]{4}$')]],
  });

  private timerInterval: any;

  async onSubmitPhone() {
    if (this.phoneForm.valid) {
      this.isLoading.set(true);
      await this.authService.sendTokenMutation.mutateAsync(
        this.phoneForm.value.phone,
      );
      this.currentStep.set('otp');
      this.startTimer();
      this.isLoading.set(false);
    }
  }

  async onSubmitOtp() {
    if (this.otpForm.valid) {
      this.isLoading.set(true);
      await this.authService.loginMutation.mutateAsync({
        phone: `0${this.phoneForm.value.phone}`,
        otp: this.otpForm.value.otp,
      });
      this.bottomSheetRef.dismiss(true);
    }
  }

  startTimer() {
    this.timer.set(60);
    this.timerInterval = setInterval(() => {
      if (this.timer() > 0) {
        this.timer.update((value) => value - 1);
      } else {
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }

  close() {
    this.bottomSheetRef.dismiss();
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }
}
