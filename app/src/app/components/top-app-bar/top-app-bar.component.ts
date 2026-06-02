import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxUserOutline, saxNotificationOutline } from '@ng-icons/iconsax/outline';
import { saxDiamondsBold, saxNotificationBold } from '@ng-icons/iconsax/bold';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SHARED } from '../../shared';
import { MatDividerModule } from '@angular/material/divider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../services/auth.service';
import { OuncePriceService } from '../../services/ounce-price.service';
import { PushNotificationService } from '../../services/push-notification.service';

@Component({
  selector: 'app-top-app-bar',
  imports: [NgIcon, CommonModule,
    MatToolbarModule,
    SHARED,
    MatButtonModule,
    MatDividerModule,],
  providers: [provideIcons({ saxDiamondsBold, saxUserOutline, saxNotificationOutline, saxNotificationBold })],
  templateUrl: './top-app-bar.component.html',
  styleUrl: './top-app-bar.component.scss',
})
export class TopAppBarComponent {
  auth = inject(AuthService);
  priceService = inject(OuncePriceService);
  pushService = inject(PushNotificationService);

  toggleNotifications() {
    if (this.pushService.isSubscribed()) {
      this.pushService.unsubscribeFromNotifications();
    } else {
      this.pushService.subscribeToNotifications();
    }
  }
}
