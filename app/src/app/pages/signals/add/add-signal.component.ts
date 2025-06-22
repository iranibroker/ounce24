import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
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
import { GemRequiredDialogComponent } from '../../../components/gem-required-dialog/gem-required-dialog.component';
import { SHARED } from '../../../shared';
import { TranslateService } from '@ngx-translate/core';

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
    SHARED,
  ],
  templateUrl: './add-signal.component.html',
  styleUrls: ['./add-signal.component.scss'],
})
export class AddSignalComponent {
  signalType = SignalType;
  form: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private translate: TranslateService,
  ) {
    this.form = this.fb.group({
      type: [SignalType.Buy, Validators.required],
      entryPrice: ['', [Validators.required, Validators.min(0)]],
      takeProfit: ['', [Validators.required, Validators.min(0)]],
      stopLoss: ['', [Validators.required, Validators.min(0)]],
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
      };

      this.http.post('/api/signals', signal).subscribe({
        next: () => {
          this.snackBar.open('Signal created successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/signals']);
        },
        error: (error) => {
          this.isSubmitting = false;
          let errorMessage = 'Failed to create signal';

          if (error.status === 429) {
            errorMessage = 'Maximum number of active signals reached';
          } else if (error.status === 408) {
            errorMessage = 'Maximum number of daily signals reached';
          } else if (error.status === 409) {
            errorMessage =
              error.error.message ||
              'You have another active signal near this point';
          } else if (error.status === 400) {
            errorMessage =
              'Invalid entry price or take profit/stop loss values';
          }

          this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
        },
      });
    }
  }

  analyzeWithAI(): void {
    this.dialog.open(GemRequiredDialogComponent, {
      data: {
        description: this.translate.instant('addSignal.gemRequired'),
      },
    });
  }

  analyzeWithAssistant(): void {
    this.http.post('/api/signals/analyze', this.form.value).subscribe({
      next: (response) => {
        console.log(response);
      },
    });
  }
}
