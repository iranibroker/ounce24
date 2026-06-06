import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxHomeOutline, saxActivityOutline, saxCupOutline, saxMicrophoneOutline, saxNotificationOutline, saxMenu1Outline, saxCandle2Outline } from '@ng-icons/iconsax/outline';
import { saxActivityBold, saxCupBold, saxMenu1Bold, saxCandle2Bold } from '@ng-icons/iconsax/bold';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { SHARED } from '../../shared';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-bottom-navigation',
  imports: [NgIcon, CommonModule, MatToolbarModule, MatButtonModule, SHARED],
  providers: [
    provideIcons({
      saxHomeOutline,
      saxActivityOutline,
      saxCupOutline,
      saxMicrophoneOutline,
      saxNotificationOutline,
      saxMenu1Outline,
      saxCandle2Outline,
      saxActivityBold,
      saxCupBold,
      saxMenu1Bold,
      saxCandle2Bold,
    }),
  ],
  templateUrl: './bottom-navigation.component.html',
  styleUrl: './bottom-navigation.component.scss',
})
export class BottomNavigationComponent {
  authService = inject(AuthService);
}
