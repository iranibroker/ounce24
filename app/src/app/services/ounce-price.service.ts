import { Injectable, signal, OnDestroy } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class OuncePriceService implements OnDestroy {
  value = signal<number>(0);
  isMarketOpen = signal<boolean>(true);
  private eventSource: EventSource | null = null;
  private checkInterval: any = null;

  constructor() {
    this.connectToStream();
    this.startLocalMarketCheck();
  }

  private calculateIsMarketOpen(date: Date = new Date()): boolean {
    const day = date.getUTCDay(); // 0: Sunday, 1: Monday, ..., 6: Saturday
    const hour = date.getUTCHours();

    // Daily break: 22:00 to 23:00 UTC is always closed
    if (hour === 22) {
      return false;
    }

    // Weekend close: Friday 22:00 UTC to Sunday 23:00 UTC
    if (day === 6) { // Saturday
      return false;
    }
    if (day === 0) { // Sunday
      return hour >= 23;
    }
    if (day === 5) { // Friday
      return hour < 22;
    }
    return true; // Mon, Tue, Wed, Thu
  }

  private startLocalMarketCheck() {
    // Run initial check
    this.isMarketOpen.set(this.calculateIsMarketOpen());
    
    // Check every 30 seconds to toggle market status dynamically
    this.checkInterval = setInterval(() => {
      this.isMarketOpen.set(this.calculateIsMarketOpen());
    }, 30000);
  }

  private connectToStream() {
    this.eventSource = new EventSource(`${environment.apiUrl}/api/ounce-price/stream`);

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.value.set(data.price);
      if (data.hasOwnProperty('isMarketOpen')) {
        this.isMarketOpen.set(data.isMarketOpen);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
      this.eventSource?.close();
      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.connectToStream(), 5000);
    };
  }

  ngOnDestroy() {
    this.eventSource?.close();
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
