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
  selector: 'app-score-info-dialog',
  templateUrl: './score-info-dialog.component.html',
  styleUrls: ['./score-info-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    TranslateModule,
    SHARED,
  ],
})
export class ScoreInfoDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ScoreInfoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }
} 