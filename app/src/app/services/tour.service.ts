import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TourService {
  showTour = signal<boolean>(false);

  startTour() {
    this.showTour.set(true);
  }

  completeTour() {
    this.showTour.set(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ounce24_needs_tour', 'false');
    }
  }
}
