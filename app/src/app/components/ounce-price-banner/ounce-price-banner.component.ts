import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OuncePriceService } from '../../services/ounce-price.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-ounce-price-banner',
  imports: [CommonModule, TranslateModule],
  templateUrl: './ounce-price-banner.component.html',
  styleUrl: './ounce-price-banner.component.scss',
})
export class OuncePriceBannerComponent {
  priceService = inject(OuncePriceService);

  color = signal<string>('');
  private lastPrice = 0;

  constructor() {
    effect(() => {
      const current = this.priceService.value();
      if (current > 0) {
        if (this.lastPrice > 0 && current !== this.lastPrice) {
          const newColor = current > this.lastPrice ? '#4ade80' : '#f87171';
          this.color.set(newColor);
          // Reset the color back to normal after 1.2 seconds
          setTimeout(() => {
            if (this.priceService.value() === current) {
              this.color.set('');
            }
          }, 1200);
        }
        this.lastPrice = current;
      }
    }, { allowSignalWrites: true });
  }
}
