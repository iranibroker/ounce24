import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxStarOutline, saxJudgeOutline, saxActivityOutline, saxTrendUpOutline } from '@ng-icons/iconsax/outline';
import { saxTrendUpBold } from '@ng-icons/iconsax/bold';
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
  imports: [NgIcon, CommonModule,
    MatDialogModule,
    MatButtonModule,
    TranslateModule,
    SHARED,],
  providers: [provideIcons({ saxStarOutline, saxJudgeOutline, saxActivityOutline, saxTrendUpOutline, saxTrendUpBold })],
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