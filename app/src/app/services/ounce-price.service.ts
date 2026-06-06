import { Injectable, signal, OnDestroy } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class OuncePriceService implements OnDestroy {
  value = signal<number>(0);
  /** Source of truth from backend SSE stream. Starts as false until first server message arrives. */
  isMarketOpen = signal<boolean>(false);
  private eventSource: EventSource | null = null;

  constructor() {
    this.connectToStream();
  }

  private connectToStream() {
    this.eventSource = new EventSource(`${environment.apiUrl}/api/ounce-price/stream`);

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.value.set(data.price);
      if (Object.prototype.hasOwnProperty.call(data, 'isMarketOpen')) {
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
  }
}

