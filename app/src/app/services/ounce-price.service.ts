import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class OuncePriceService {
  value = signal<number>(0);
  private eventSource: EventSource | null = null;

  constructor() {
    this.connectToStream();
  }

  private connectToStream() {
    this.eventSource = new EventSource(`${environment.apiUrl}/api/ounce-price/stream`);

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.value.set(data.price);
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
