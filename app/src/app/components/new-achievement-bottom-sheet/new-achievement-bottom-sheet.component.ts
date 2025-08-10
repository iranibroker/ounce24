import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { SHARED } from '../../shared';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { Achievement } from '@ounce24/types';

@Component({
  selector: 'app-new-achievement-bottom-sheet',
  imports: [CommonModule, MatToolbarModule, MatButtonModule, SHARED],
  templateUrl: './new-achievement-bottom-sheet.component.html',
  styleUrl: './new-achievement-bottom-sheet.component.scss',
})
export class NewAchievementBottomSheetComponent {
  private readonly bottomSheetRef = inject(MatBottomSheetRef);
  achievement = inject(MAT_BOTTOM_SHEET_DATA) as Achievement;

  close() {
    this.bottomSheetRef.dismiss();
  }
}
