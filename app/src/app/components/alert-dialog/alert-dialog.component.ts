import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxInfoCircleOutline, saxCloseCircleOutline } from '@ng-icons/iconsax/outline';
import { Component, inject, Inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alert-dialog',
  templateUrl: './alert-dialog.component.html',
  styleUrls: ['./alert-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    TranslateModule,
    NgIcon,
  ],
  providers: [provideIcons({ saxInfoCircleOutline, saxCloseCircleOutline })],
})
export class AlertDialogComponent {
  public dialogRef = inject(MatDialogRef<AlertDialogComponent>);

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: {
      title?: string;
      message: string;
      isError?: boolean;
      buttonText?: string;
    }
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }
}
