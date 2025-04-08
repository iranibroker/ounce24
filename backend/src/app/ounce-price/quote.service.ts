import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { TvApiAdapter } from 'tradingview-api-adapter';
import { Quote } from 'tradingview-api-adapter/dist/Quote';

@Injectable()
export class QuoteService {
  private reconnectTimeout: any;
  private readonly TIMEOUT_MS = 5000;
  private adapter = new TvApiAdapter();
  private quote: Quote;
  private quoteUpdateSubject = new Subject<number>();
  public data = this.quoteUpdateSubject.asObservable();

  constructor() {
    this.startListening();
  }

  private startListening() {
    this.quote = this.adapter.Quote('XAUUSD', 'OANDA', ['lp']);

    const resetTimer = () => {
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = setTimeout(() => {
        console.warn('No data received. Reconnecting...');
        this.restartListening();
      }, this.TIMEOUT_MS);
    };

    this.quote.listen((data) => {
      this.quoteUpdateSubject.next(data['lp']);
      resetTimer(); // Reset watchdog timer on each update
    });

    resetTimer(); // Start initial watchdog
  }

  private restartListening() {
    try {
      this.quote?.pause();
    } catch (e) {
      console.error('Pause error:', e);
    }
    this.startListening();
  }
}
