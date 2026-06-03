import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxGlobalOutline } from '@ng-icons/iconsax/outline';
import { LanguageService, LanguageConfig } from '../../services/language.service';

@Component({
  selector: 'app-language-selection-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    TranslateModule,
    NgIcon,
  ],
  providers: [provideIcons({ saxGlobalOutline })],
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