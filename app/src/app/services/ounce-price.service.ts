import { Injectable, signal } from '@angular/core';
import { TvApiAdapter } from 'tradingview-api-adapter';

@Injectable({
  providedIn: 'root',
})
export class OuncePriceService {
  private readonly adapter = new TvApiAdapter();
  value = signal<number>(0);
  constructor() {
    this.adapter.Quote('XAUUSD', 'OANDA', ['lp']).listen((data) => {
      const price = Number(data['lp']);
      this.value.set(price);
    });
  }
}
