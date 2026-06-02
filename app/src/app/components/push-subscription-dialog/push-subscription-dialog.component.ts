import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxNotificationOutline } from '@ng-icons/iconsax/outline';
import { Component, inject } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-push-subscription-dialog',
  templateUrl: './push-subscription-dialog.component.html',
  styleUrls: ['./push-subscription-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    TranslateModule,
    NgIcon,
  ],
  providers: [provideIcons({ saxNotificationOutline })],
})
export class PushSubscriptionDialogComponent {
  public dialogRef = inject(MatDialogRef<PushSubscriptionDialogComponent>);

  onClose(): void {
    this.dialogRef.close(false);
  }

  onAccept(): void {
    this.dialogRef.close(true);
  }
}
