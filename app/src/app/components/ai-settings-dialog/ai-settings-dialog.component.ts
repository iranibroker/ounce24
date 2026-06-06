import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { TradingStyle, RiskTolerance } from '@ounce24/types';

export interface AiSettingsDialogData {
  title: string;
  description?: string;
  confirmLabel: string;
  tradingStyle: TradingStyle;
  riskTolerance: RiskTolerance;
  hideTradingStyle?: boolean;
}

@Component({
  selector: 'app-ai-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    TranslateModule,
    FormsModule,
  ],
  templateUrl: './ai-settings-dialog.component.html',
  styleUrls: ['./ai-settings-dialog.component.scss'],
})
export class AiSettingsDialogComponent {
  public dialogRef = inject(MatDialogRef<AiSettingsDialogComponent>);
  public tradingStyle: TradingStyle;
  public riskTolerance: RiskTolerance;
  
  TradingStyle = TradingStyle;
  RiskTolerance = RiskTolerance;

  constructor(@Inject(MAT_DIALOG_DATA) public data: AiSettingsDialogData) {
    this.tradingStyle = data.tradingStyle || TradingStyle.Day;
    this.riskTolerance = data.riskTolerance || RiskTolerance.Moderate;
  }

  confirm(): void {
    this.dialogRef.close({
      tradingStyle: this.tradingStyle,
      riskTolerance: this.riskTolerance,
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
