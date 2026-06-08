import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialog } from '@angular/material/dialog';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { 
  saxArrowLeftOutline, 
  saxNotificationOutline, 
  saxDocumentDownloadOutline, 
  saxGlobalOutline, 
  saxLogoutOutline,
  saxCpuOutline,
  saxTeacherOutline,
  sax24SupportOutline
} from '@ng-icons/iconsax/outline';
import { saxDiamondsBold } from '@ng-icons/iconsax/bold';
import { PushNotificationService } from '../../services/push-notification.service';
import { LanguageService } from '../../services/language.service';
import { AuthService } from '../../services/auth.service';
import { LanguageSelectionModalComponent } from '../../components/language-selection-modal/language-selection-modal.component';
import { PwaService } from '../../services/pwa.service';
import { PwaInstallDialogComponent } from '../../components/pwa-install-dialog/pwa-install-dialog.component';
import { environment } from '../../../environments/environment';
import { SHARED } from '../../shared';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatToolbarModule,
    NgIcon,
    SHARED,
  ],
  providers: [
    provideIcons({
      saxArrowLeftOutline,
      saxNotificationOutline,
      saxDocumentDownloadOutline,
      saxGlobalOutline,
      saxLogoutOutline,
      saxDiamondsBold,
      saxCpuOutline,
      saxTeacherOutline,
      sax24SupportOutline,
    }),
  ],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
})
export class MenuComponent {
  public readonly auth = inject(AuthService);
  public readonly pushService = inject(PushNotificationService);
  public readonly languageService = inject(LanguageService);
  public readonly pwaService = inject(PwaService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  showPwaInstallPrompt() {
    const dialogRef = this.dialog.open(PwaInstallDialogComponent, {
      width: '400px',
      maxWidth: '95vw',
      panelClass: 'push-notification-dialog-panel',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((accept: boolean) => {
      if (accept) {
        this.pwaService.install();
      }
    });
  }

  downloadChartData(format: 'csv' | 'json') {
    const url = `${environment.apiUrl}/api/ounce-price/history?format=${format}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `gold_price_history.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  openLanguageSelection() {
    this.dialog.open(LanguageSelectionModalComponent, {
      width: '400px',
      maxWidth: '95vw',
    });
  }

  contactSupport() {
    window.open('https://t.me/ounce24_support', '_blank');
  }

  logout() {
    this.auth.token.set(null);
    this.router.navigate(['/login']);
  }
}
