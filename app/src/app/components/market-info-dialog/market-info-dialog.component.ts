import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  saxInfoCircleOutline,
  saxCloseCircleOutline,
  saxActivityOutline,
  saxJudgeOutline,
  saxTrendUpOutline,
} from '@ng-icons/iconsax/outline';
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
  selector: 'app-market-info-dialog',
  templateUrl: './market-info-dialog.component.html',
  styleUrls: ['./market-info-dialog.component.scss'],
  standalone: true,
  imports: [
    NgIcon,
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    TranslateModule,
    SHARED,
  ],
  providers: [
    provideIcons({
      saxInfoCircleOutline,
      saxCloseCircleOutline,
      saxActivityOutline,
      saxJudgeOutline,
      saxTrendUpOutline,
    }),
  ],
})
export class MarketInfoDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<MarketInfoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { key: string },
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}
