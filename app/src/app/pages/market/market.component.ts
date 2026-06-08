import { Component, inject, signal, computed } from '@angular/core';
import { OuncePriceService } from '../../services/ounce-price.service';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { SHARED } from '../../shared';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslateService } from '@ngx-translate/core';
import { MarketInfoDialogComponent } from '../../components/market-info-dialog/market-info-dialog.component';
import {
  saxTrendUpOutline,
  saxTrendDownOutline,
  saxActivityOutline,
  saxChartOutline,
  saxEyeOutline,
  saxEyeSlashOutline,
  saxInfoCircleOutline,
} from '@ng-icons/iconsax/outline';
import { DataLoadingComponent } from '../../components/data-loading/data-loading.component';

export interface SMCOrderBlock {
  type: 'Bullish' | 'Bearish';
  top: number;
  bottom: number;
  mitigated: boolean;
  timeframe: '15m' | '1h';
}

export interface SMCFairValueGap {
  type: 'Bullish' | 'Bearish';
  top: number;
  bottom: number;
  mitigated: boolean;
  timeframe: '15m' | '1h';
}

export interface SMCMarketStructure {
  type: 'BOS' | 'CHoCH';
  direction: 'Bullish' | 'Bearish';
  price: number;
  timeframe: '15m' | '1h';
}

export interface MarketStateSummary {
  currentPrice: number;
  trend5m: 'Bullish' | 'Bearish' | 'Consolidating';
  sma20_5m: number;
  sma50_5m: number;
  trend15m: 'Bullish' | 'Bearish' | 'Consolidating';
  sma20_15m: number;
  sma50_15m: number;
  trend1h: 'Bullish' | 'Bearish' | 'Consolidating';
  sma20_1h: number;
  sma50_1h: number;
  trend4h: 'Bullish' | 'Bearish' | 'Consolidating';
  sma20_4h: number;
  sma50_4h: number;
  rsi5m: number;
  rsi15m: number;
  rsi1h: number;
  rsi4h: number;
  atr5m: number;
  atr1h: number;
  atr4h: number;
  keySupports: number[];
  keyResistances: number[];
  semanticText: string;
  smcOrderBlocks: SMCOrderBlock[];
  smcFVGs: SMCFairValueGap[];
  marketStructure: SMCMarketStructure[];
}

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatButtonToggleModule,
    NgIcon,
    SHARED,
    DataLoadingComponent,
  ],
  providers: [
    provideIcons({
      saxTrendUpOutline,
      saxTrendDownOutline,
      saxActivityOutline,
      saxChartOutline,
      saxEyeOutline,
      saxEyeSlashOutline,
      saxInfoCircleOutline,
    }),
  ],
  templateUrl: './market.component.html',
  styleUrl: './market.component.scss',
})
export class MarketComponent {
  private readonly http = inject(HttpClient);
  public readonly priceService = inject(OuncePriceService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  activeTab = signal<'analysis' | 'chart'>('analysis');
  currentTime = signal(Date.now());

  lastUpdateText = computed(() => {
    const updatedAt = this.query.dataUpdatedAt();
    if (!updatedAt) return '';

    const diffMs = this.currentTime() - updatedAt;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return this.translate.instant('market.updatedJustNow');
    }
    return this.translate.instant('market.updatedMinutesAgo', { count: diffMins });
  });

  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('market_active_tab');
      if (saved === 'analysis' || saved === 'chart') {
        this.activeTab.set(saved);
      }
    }

    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.currentTime.set(Date.now());
      }, 10000);
    }
  }

  openInfo(key: string) {
    this.dialog.open(MarketInfoDialogComponent, {
      width: '450px',
      maxWidth: '95vw',
      data: { key },
    });
  }

  setTab(value: 'analysis' | 'chart') {
    this.activeTab.set(value);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('market_active_tab', value);
    }
  }

  query = injectQuery(() => ({
    queryKey: ['marketState'],
    queryFn: () =>
      lastValueFrom(
        this.http.get<MarketStateSummary>('/api/signals/market/state')
      ),
    refetchInterval: 60000,
  }));

  getRsiInterpretation(rsi: number): 'overbought' | 'oversold' | 'neutral' {
    if (rsi >= 70) return 'overbought';
    if (rsi <= 30) return 'oversold';
    return 'neutral';
  }
}
