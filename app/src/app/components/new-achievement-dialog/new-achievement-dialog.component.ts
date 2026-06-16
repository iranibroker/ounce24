import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { SHARED } from '../../shared';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { Achievement, AchievementType } from '@ounce24/types';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { ACHIEVEMENT_ICONS_MAP, getAchievementIcon, getAchievementClass } from '../../shared/utils/achievement-helper';

@Component({
  selector: 'app-new-achievement-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    TranslateModule,
    SHARED,
    NgIcon,
  ],
  providers: [
    provideIcons(ACHIEVEMENT_ICONS_MAP),
  ],
  templateUrl: './new-achievement-dialog.component.html',
  styleUrls: ['./new-achievement-dialog.component.scss'],
})
export class NewAchievementDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<NewAchievementDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public achievement: Achievement,
  ) {}

  getAchievementIcon(type: AchievementType): string {
    return getAchievementIcon(type);
  }

  getAchievementClass(type: AchievementType): string {
    return getAchievementClass(type);
  }

  close() {
    this.dialogRef.close();
  }
}
