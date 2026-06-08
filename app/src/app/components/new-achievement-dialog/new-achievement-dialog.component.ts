import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { SHARED } from '../../shared';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { Achievement } from '@ounce24/types';

@Component({
  selector: 'app-new-achievement-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    TranslateModule,
    SHARED,
  ],
  templateUrl: './new-achievement-dialog.component.html',
  styleUrls: ['./new-achievement-dialog.component.scss'],
})
export class NewAchievementDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<NewAchievementDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public achievement: Achievement,
  ) {}

  close() {
    this.dialogRef.close();
  }
}
