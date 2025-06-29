import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService, LanguageConfig } from '../../services/language.service';

@Component({
  selector: 'app-language-selection-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    TranslateModule,
  ],
  templateUrl: './language-selection-modal.component.html',
  styleUrls: ['./language-selection-modal.component.scss'],
})
export class LanguageSelectionModalComponent {
  public dialogRef = inject(MatDialogRef<LanguageSelectionModalComponent>);
  public languageService = inject(LanguageService);

  supportedLanguages: LanguageConfig[] = this.languageService.getSupportedLanguages();

  selectLanguage(language: LanguageConfig): void {
    this.languageService.setLanguage(language.code);
    this.dialogRef.close(language.code);
  }

  close(): void {
    this.dialogRef.close();
  }
} 