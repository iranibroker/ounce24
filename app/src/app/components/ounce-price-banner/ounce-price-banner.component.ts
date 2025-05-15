import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OuncePriceService } from '../../services/ounce-price.service';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-ounce-price-banner',
  imports: [CommonModule, MatToolbarModule, MatDividerModule],
  templateUrl: './ounce-price-banner.component.html',
  styleUrl: './ounce-price-banner.component.scss',
})
export class OuncePriceBannerComponent {
  prevPrice = signal<number>(0);
  priceService = inject(OuncePriceService);

  color = computed(() => {
    // const color =
    //   this.prevPrice() > this.priceService.value() ? 'red' : 'green';

    // return color;
  });
}
