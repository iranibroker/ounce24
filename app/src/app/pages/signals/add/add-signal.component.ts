import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxArrowLeftOutline, saxTrendUpOutline, saxTrendDownOutline } from '@ng-icons/iconsax/outline';
import { saxTrendUpBold, saxTrendDownBold } from '@ng-icons/iconsax/bold';
import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
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
import { SignalType, TradingStyle, RiskTolerance } from '@ounce24/types';
import { SHARED } from '../../../shared';
import { SignalAnalyzeService } from '../../../services/signal-analyze.service';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { OuncePriceService } from '../../../services/ounce-price.service';
import { AnalyticsService } from '../../../services/analytics.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-add-signal',
  standalone: true,
  imports: [NgIcon, CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatCheckboxModule,
    SHARED,],
  providers: [provideIcons({ saxArrowLeftOutline, saxTrendUpBold, saxTrendDownBold, saxTrendUpOutline, saxTrendDownOutline })],
  templateUrl: './add-signal.component.html',
  styleUrls: ['./add-signal.component.scss'],
})
export class AddSignalComponent {
  signalType = SignalType;
  form: FormGroup;
  isSubmitting = false;
  isGenerating = false;
  private ounceService = inject(OuncePriceService);
  private auth = inject(AuthService);
  private translateService = inject(TranslateService);

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
      generationAnalysis: [''],
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
        generationAnalysis: formValue.generationAnalysis,
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
    this.analyzeService.openSignalAnalyze(this.form.getRawValue());
  }

  generateWithAI(): void {
    if (this.isGenerating) return;

    this.isGenerating = true;
    const user = this.auth.userQuery.data();
    const style = user?.tradingStyle || TradingStyle.Day;
    const risk = user?.riskTolerance || RiskTolerance.Moderate;

    this.http.post<{
      signal: {
        type: 'buy' | 'sell';
        entryPrice: number;
        takeProfit: number;
        stopLoss: number;
        instantEntry: boolean;
        generationAnalysis?: string;
      } | null;
      rawText: string;
      parseError: boolean;
    }>(`/api/signals/generate?tradingStyle=${style}&riskTolerance=${risk}`, {}).subscribe({
      next: (response) => {
        this.isGenerating = false;
        
        if (response.parseError) {
          const alertMessage = this.translateService.instant('addSignal.generateError', { rawText: response.rawText });
          window.alert(alertMessage);
          return;
        }

        if (!response.signal) {
          const alertMessage = this.translateService.instant('addSignal.noSetupFound');
          window.alert(alertMessage);
          return;
        }

        const generated = response.signal;
        const type = generated.type === 'buy' ? SignalType.Buy : SignalType.Sell;
        
        this.form.patchValue({
          type: type,
          entryPrice: generated.entryPrice,
          takeProfit: generated.takeProfit,
          stopLoss: generated.stopLoss,
          instantEntry: generated.instantEntry,
          generationAnalysis: generated.generationAnalysis || '',
        });

        this.snackBar.open('Signal generated and filled successfully!', 'Close', {
          duration: 3000,
        });
      },
      error: (err) => {
        this.isGenerating = false;
        let errorMessage = 'Failed to generate signal';
        if (err.error && err.error.translationKey) {
          errorMessage = err.error.translationKey;
        }
        this.snackBar.open(errorMessage, 'Close', {
          duration: 3000,
        });
      }
    });
  }
}
