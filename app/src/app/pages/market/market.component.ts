import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { SHARED } from '../../shared';
import { NgIcon, provideIcons } from '@ng-icons/core';
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
  rsi5m: number;
  rsi15m: number;
  rsi1h: number;
  atr5m: number;
  atr1h: number;
  keySupports: number[];
  keyResistances: number[];
  semanticText: string;
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
  
  activeTab = signal<'analysis' | 'chart'>('analysis');

  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('market_active_tab');
      if (saved === 'analysis' || saved === 'chart') {
        this.activeTab.set(saved);
      }
    }
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
