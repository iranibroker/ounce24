import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { 
  saxArrowLeftOutline, 
  saxNotificationOutline, 
  saxActivityOutline,
  saxShieldOutline,
  saxInfoCircleOutline
} from '@ng-icons/iconsax/outline';
import { PushNotificationService } from '../../services/push-notification.service';
import { AuthService } from '../../services/auth.service';
import { SHARED } from '../../shared';

@Component({
  selector: 'app-notification-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatSlideToggleModule,
    MatToolbarModule,
    MatButtonModule,
    NgIcon,
    SHARED,
  ],
  providers: [
    provideIcons({
      saxArrowLeftOutline,
      saxNotificationOutline,
      saxActivityOutline,
      saxShieldOutline,
      saxInfoCircleOutline,
    }),
  ],
  templateUrl: './notification-settings.component.html',
  styleUrls: ['./notification-settings.component.scss'],
})
export class NotificationSettingsComponent {
  public readonly auth = inject(AuthService);
  public readonly pushService = inject(PushNotificationService);

  async onMasterToggleChange(checked: boolean) {
    if (checked) {
      const success = await this.pushService.subscribeToNotifications();
      if (success) {
        // When toggling ON: set all 3 backend flags to true
        await this.pushService.updateNotificationSettings({
          notifPrice: true,
          notifSignalFollow: true,
          notifAiShield: true,
        });
      }
    } else {
      await this.pushService.unsubscribeFromNotifications();
    }
  }

  async onChannelToggleChange(channel: 'notifPrice' | 'notifSignalFollow' | 'notifAiShield', checked: boolean) {
    await this.pushService.updateNotificationSettings({
      [channel]: checked,
    });
  }
}
