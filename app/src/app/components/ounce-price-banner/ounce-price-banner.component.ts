import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxExport3Outline } from '@ng-icons/iconsax/outline';
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OuncePriceService } from '../../services/ounce-price.service';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { MatRippleModule } from '@angular/material/core';

@Component({
  selector: 'app-ounce-price-banner',
  imports: [NgIcon, CommonModule, MatToolbarModule, MatDividerModule, MatRippleModule],
  providers: [provideIcons({ saxExport3Outline })],
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
