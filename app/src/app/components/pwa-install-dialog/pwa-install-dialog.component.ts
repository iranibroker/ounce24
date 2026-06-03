import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxImportOutline, saxInfoCircleOutline } from '@ng-icons/iconsax/outline';
import { Component, inject } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { PwaService } from '../../services/pwa.service';

@Component({
  selector: 'app-pwa-install-dialog',
  templateUrl: './pwa-install-dialog.component.html',
  styleUrls: ['./pwa-install-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    TranslateModule,
    NgIcon,
  ],
  providers: [provideIcons({ saxImportOutline, saxInfoCircleOutline })],
})
export class PwaInstallDialogComponent {
  public dialogRef = inject(MatDialogRef<PwaInstallDialogComponent>);
  private pwaService = inject(PwaService);

  isIOS = this.pwaService.isIOS();

  onClose(): void {
    this.dialogRef.close(false);
  }

  onAccept(): void {
    this.dialogRef.close(true);
  }
}
