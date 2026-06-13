import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { TvApiAdapter } from 'tradingview-api-adapter';
import { Quote } from 'tradingview-api-adapter/dist/Quote';

@Injectable()
export class QuoteService {
  private reconnectTimeout: any;
  private readonly TIMEOUT_MS = 10000;
  private adapter: TvApiAdapter;
  private quote: Quote;
  private quoteUpdateSubject = new Subject<number>();
  public data = this.quoteUpdateSubject.asObservable();
  private isRunning = false;

  constructor() {}

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startListening();
  }

  public stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      this.quote?.pause();
    } catch (e) {
      console.error('Pause error:', e);
    }
  }

  private startListening() {
    if (!this.isRunning) return;
    this.adapter = new TvApiAdapter();
    this.quote = this.adapter.Quote('XAUUSD', 'OANDA', ['lp']);

    const resetTimer = () => {
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      if (!this.isRunning) return;
      this.reconnectTimeout = setTimeout(() => {
        console.warn('No data received. Reconnecting...');
        this.restartListening();
      }, this.TIMEOUT_MS);
    };

    this.quote.listen((data) => {
      if (!this.isRunning) return;
      this.quoteUpdateSubject.next(data['lp']);
      resetTimer(); // Reset watchdog timer on each update
    });

    resetTimer(); // Start initial watchdog
  }

  private restartListening() {
    if (!this.isRunning) return;
    try {
      this.quote?.pause();
    } catch (e) {
      console.error('Pause error:', e);
    }
    this.startListening();
  }
}
