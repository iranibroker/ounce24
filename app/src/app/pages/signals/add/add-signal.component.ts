import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SignalType } from '@ounce24/types';
import { SHARED } from '../../../shared';
import { SignalAnalyzeService } from '../../../services/signal-analyze.service';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { OuncePriceService } from '../../../services/ounce-price.service';
import { AnalyticsService } from '../../../services/analytics.service';

@Component({
  selector: 'app-add-signal',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatCheckboxModule,
    SHARED,
  ],
  templateUrl: './add-signal.component.html',
  styleUrls: ['./add-signal.component.scss'],
})
export class AddSignalComponent {
  signalType = SignalType;
  form: FormGroup;
  isSubmitting = false;
  private ounceService = inject(OuncePriceService);

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private analyzeService: SignalAnalyzeService,
    private analyticsService: AnalyticsService,
  ) {
    this.form = this.fb.group({
      type: [SignalType.Buy, Validators.required],
      entryPrice: ['', [Validators.required, Validators.min(0)]],
      takeProfit: ['', [Validators.required, Validators.min(0)]],
      stopLoss: ['', [Validators.required, Validators.min(0)]],
      instantEntry: [false],
    });

    // Add validators based on signal type
    this.form.get('type')?.valueChanges.subscribe((type) => {
      const entryPrice = this.form.get('entryPrice');
      const takeProfit = this.form.get('takeProfit');
      const stopLoss = this.form.get('stopLoss');

      if (type === SignalType.Buy) {
        takeProfit?.setValidators([
          Validators.required,
          Validators.min(0),
          (control) => {
            if (entryPrice?.value && control.value <= entryPrice.value) {
              return { takeProfitInvalid: true };
            }
            return null;
          },
        ]);
        stopLoss?.setValidators([
          Validators.required,
          Validators.min(0),
          (control) => {
            if (entryPrice?.value && control.value >= entryPrice.value) {
              return { stopLossInvalid: true };
            }
            return null;
          },
        ]);
      } else {
        takeProfit?.setValidators([
          Validators.required,
          Validators.min(0),
          (control) => {
            if (entryPrice?.value && control.value >= entryPrice.value) {
              return { takeProfitInvalid: true };
            }
            return null;
          },
        ]);
        stopLoss?.setValidators([
          Validators.required,
          Validators.min(0),
          (control) => {
            if (entryPrice?.value && control.value <= entryPrice.value) {
              return { stopLossInvalid: true };
            }
            return null;
          },
        ]);
      }

      takeProfit?.updateValueAndValidity();
      stopLoss?.updateValueAndValidity();
    });

    this.form.get('instantEntry')?.valueChanges.subscribe((instantEntry) => {
      if (instantEntry) {
        this.form.get('entryPrice')?.disable();
        this.form.get('entryPrice')?.setValue(this.ounceService.value());
      } else {
        this.form.get('entryPrice')?.enable();
      }
    });

    effect(() => {
      const currentOuncePrice = this.ounceService.value();
      if (this.form.get('instantEntry')?.value) {
        this.form.get('entryPrice')?.setValue(currentOuncePrice);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/signals']);
  }

  onSubmit(): void {
    if (this.form.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      const formValue = this.form.value;

      const signal = {
        type: formValue.type,
        entryPrice: formValue.entryPrice,
        maxPrice:
          formValue.type === SignalType.Buy
            ? formValue.takeProfit
            : formValue.stopLoss,
        minPrice:
          formValue.type === SignalType.Buy
            ? formValue.stopLoss
            : formValue.takeProfit,
        instantEntry: formValue.instantEntry,
      };

      this.http.post('/api/signals', signal).subscribe({
        next: () => {
          this.snackBar.open('Signal created successfully', 'Close', {
            duration: 3000,
          });
          this.analyticsService.trackEvent('signal_created', {
            signal,
          });
          this.router.navigate(['/signals']);
        },
        error: (error) => {
          this.isSubmitting = false;
        },
      });
    }
  }

  analyzeWithAI(): void {
    this.analyzeService.openSignalAnalyze(this.form.value);
  }
}
