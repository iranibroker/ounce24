import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxDiamondsOutline, saxUserOutline } from '@ng-icons/iconsax/outline';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SHARED } from '../../shared';
import { MatDividerModule } from '@angular/material/divider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../services/auth.service';
import { OuncePriceService } from '../../services/ounce-price.service';

@Component({
  selector: 'app-top-app-bar',
  imports: [NgIcon, CommonModule,
    MatToolbarModule,
    SHARED,
    MatButtonModule,
    MatDividerModule,],
  providers: [provideIcons({ saxDiamondsOutline, saxUserOutline })],
  templateUrl: './top-app-bar.component.html',
  styleUrl: './top-app-bar.component.scss',
})
export class TopAppBarComponent {
  auth = inject(AuthService);
  priceService = inject(OuncePriceService);
}
