import {
  Component,
  computed,
  inject,
  input,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SHARED } from '../../shared';
import { Signal, SignalStatus, SignalType } from '@ounce24/types';
import { OuncePriceService } from '../../services/ounce-price.service';

@Component({
  selector: 'app-volume-calculator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    SHARED,
  ],
  templateUrl: './volume-calculator.component.html',
  styleUrls: ['./volume-calculator.component.scss'],
})
export class VolumeCalculatorComponent implements OnInit {
  private readonly ouncePrice = inject(OuncePriceService);

  signal = input.required<Signal>();

  // Calculator inputs driven by Angular signals
  volume = signal<number>(0.1);
  balance = signal<number | null>(null);
  leverage = signal<number>(100);
  showCustomPrices = signal<boolean>(false);

  // User-modifiable custom price targets
  customEntryPrice = signal<number | null>(null);
  customTakeProfit = signal<number | null>(null);
  customStopLoss = signal<number | null>(null);

  // Computations ensuring safe numeric fallback
  entryPrice = computed(() => {
    const custom = this.customEntryPrice();
    return custom !== null && custom !== undefined && !isNaN(custom)
      ? custom
      : this.signal().entryPrice;
  });

  takeProfit = computed(() => {
    const custom = this.customTakeProfit();
    return custom !== null && custom !== undefined && !isNaN(custom)
      ? custom
      : this.signal().profit;
  });

  stopLoss = computed(() => {
    const custom = this.customStopLoss();
    return custom !== null && custom !== undefined && !isNaN(custom)
      ? custom
      : this.signal().loss;
  });

  // Constants: Gold Contract Size (1 Lot XAU/USD = 100 ounces)
  private readonly CONTRACT_SIZE = 100;

  // Real-time market price (or close price if closed)
  currentPrice = computed(() => {
    if (this.signal().status === SignalStatus.Active) {
      return this.ouncePrice.value();
    } else if (this.signal().status === SignalStatus.Closed) {
      return this.signal().closedOuncePrice ?? this.signal().entryPrice;
    }
    return this.signal().entryPrice;
  });

  // Calculate profit at Take Profit price (in USD)
  profitAtTp = computed(() => {
    const vol = Number(this.volume()) || 0;
    const entry = Number(this.entryPrice()) || 0;
    const tp = Number(this.takeProfit()) || 0;
    const isSell = this.signal().type === SignalType.Sell;

    const diff = isSell ? entry - tp : tp - entry;
    return vol * this.CONTRACT_SIZE * diff;
  });

  // Calculate loss at Stop Loss price (in USD)
  lossAtSl = computed(() => {
    const vol = Number(this.volume()) || 0;
    const entry = Number(this.entryPrice()) || 0;
    const sl = Number(this.stopLoss()) || 0;
    const isSell = this.signal().type === SignalType.Sell;

    const diff = isSell ? sl - entry : entry - sl;
    return vol * this.CONTRACT_SIZE * diff;
  });

  // Calculate current or final profit/loss (in USD)
  currentPnl = computed(() => {
    const vol = Number(this.volume()) || 0;
    const entry = Number(this.entryPrice()) || 0;
    const curPrice = Number(this.currentPrice()) || 0;
    const isSell = this.signal().type === SignalType.Sell;

    const diff = isSell ? entry - curPrice : curPrice - entry;
    return vol * this.CONTRACT_SIZE * diff;
  });

  // Dynamic Risk-Reward Ratio based on active inputs
  riskReward = computed(() => {
    const profit = Math.abs(this.profitAtTp());
    const loss = Math.abs(this.lossAtSl());
    if (loss === 0) return 0;
    return Number((profit / loss).toFixed(2));
  });

  // Risk percentage of balance (if balance is set)
  riskPercent = computed(() => {
    const bal = this.balance();
    if (!bal || bal <= 0) return null;
    const loss = Math.abs(this.lossAtSl());
    return Number(((loss / bal) * 100).toFixed(2));
  });

  // Reward percentage of balance (if balance is set)
  rewardPercent = computed(() => {
    const bal = this.balance();
    if (!bal || bal <= 0) return null;
    const profit = Math.abs(this.profitAtTp());
    return Number(((profit / bal) * 100).toFixed(2));
  });

  // Current PNL percentage of balance (if balance is set)
  currentPnlPercent = computed(() => {
    const bal = this.balance();
    if (!bal || bal <= 0) return null;
    const pnl = this.currentPnl();
    return Number(((pnl / bal) * 100).toFixed(2));
  });

  // Required Margin Calculation
  requiredMargin = computed(() => {
    const vol = Number(this.volume()) || 0;
    const entry = Number(this.entryPrice()) || 0;
    const lev = Number(this.leverage()) || 100;
    if (lev <= 0 || vol <= 0) return 0;
    return (vol * this.CONTRACT_SIZE * entry) / lev;
  });

  // Estimated Liquidation Price (assuming standard 50% Stop Out level)
  liquidationPrice = computed(() => {
    const bal = Number(this.balance()) || 0;
    const vol = Number(this.volume()) || 0;
    const entry = Number(this.entryPrice()) || 0;
    const margin = this.requiredMargin();
    const isSell = this.signal().type === SignalType.Sell;

    if (bal <= 0 || vol <= 0 || entry <= 0 || margin <= 0) return null;

    const stopOutLevel = 0.5; // 50% stop out is extremely common in gold/forex
    const maxAllowedLoss = bal - margin * stopOutLevel;
    const priceMovement = maxAllowedLoss / (vol * this.CONTRACT_SIZE);

    const liq = isSell ? entry + priceMovement : entry - priceMovement;
    return liq > 0 ? Number(liq.toFixed(2)) : 0;
  });

  // Flags if account is highly likely to be liquidated before reaching SL
  isLiquidationBeforeSl = computed(() => {
    const liq = this.liquidationPrice();
    const sl = Number(this.stopLoss()) || 0;
    const entry = Number(this.entryPrice()) || 0;
    const isSell = this.signal().type === SignalType.Sell;

    if (!liq || sl <= 0 || entry <= 0) return false;

    if (isSell) {
      // Sell: loses when price rises. If liquidation price is below or equal to SL, it triggers first
      return liq <= sl;
    } else {
      // Buy: loses when price falls. If liquidation price is above or equal to SL, it triggers first
      return liq >= sl;
    }
  });

  // Recommends safe volume sizing (risking exactly 2% of capital)
  recommendedVolume = computed(() => {
    const bal = this.balance();
    const entry = Number(this.entryPrice()) || 0;
    const sl = Number(this.stopLoss()) || 0;

    if (!bal || bal <= 0 || entry <= 0 || sl <= 0) return null;

    const slDistance = Math.abs(entry - sl);
    if (slDistance <= 0) return null;

    const allowedRiskAmount = bal * 0.02; // 2% risk rule
    const vol = allowedRiskAmount / (slDistance * this.CONTRACT_SIZE);
    return Number(vol.toFixed(3));
  });

  ngOnInit() {
    // Pre-populate input models with values from the signal input
    this.customEntryPrice.set(this.signal().entryPrice);
    this.customTakeProfit.set(this.signal().profit);
    this.customStopLoss.set(this.signal().loss);
  }
}
