import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SHARED } from '../../shared';
import { MatDividerModule } from '@angular/material/divider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../services/auth.service';
import { OuncePriceService } from '../../services/ounce-price.service';
import { LanguageService } from '../../services/language.service';
import { LanguageSelectionModalComponent } from '../language-selection-modal/language-selection-modal.component';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-top-app-bar',
  imports: [
    CommonModule,
    MatToolbarModule,
    SHARED,
    MatButtonModule,
    MatDividerModule,
    MatMenuModule,
  ],
  templateUrl: './top-app-bar.component.html',
  styleUrl: './top-app-bar.component.scss',
})
export class TopAppBarComponent {
  auth = inject(AuthService);
  languageService = inject(LanguageService);
  priceService = inject(OuncePriceService);
  dialog = inject(MatDialog);

  toggleLanguage() {
    this.dialog.open(LanguageSelectionModalComponent, {
      width: '500px',
      disableClose: true, // Prevent closing without selecting a language
      panelClass: 'language-selection-dialog'
    });
  }
}
