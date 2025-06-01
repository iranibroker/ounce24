import { Component, Inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { SHARED } from '../../shared';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gem-required-dialog',
  templateUrl: './gem-required-dialog.component.html',
  styleUrls: ['./gem-required-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    TranslateModule,
    SHARED,
  ],
})
export class GemRequiredDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<GemRequiredDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { description: string },
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }
}
