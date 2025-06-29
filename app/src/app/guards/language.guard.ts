import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { LanguageService } from '../services/language.service';
import { LanguageSelectionModalComponent } from '../components/language-selection-modal/language-selection-modal.component';
import { firstValueFrom } from 'rxjs';

export const languageGuard: CanActivateFn = async (route, state) => {
  const languageService = inject(LanguageService);
  const dialog = inject(MatDialog);
  const router = inject(Router);

  // Check if user has explicitly selected a language (not just the default)
  const hasExplicitLanguageSelection = languageService.hasExplicitLanguageSelection();
  
  if (!hasExplicitLanguageSelection) {
    // Open the language selection modal
    const dialogRef = dialog.open(LanguageSelectionModalComponent, {
      width: '500px',
      disableClose: true, // Prevent closing without selecting a language
      panelClass: 'language-selection-dialog'
    });

    try {
      // Wait for the user to select a language
      const selectedLanguage = await firstValueFrom(dialogRef.afterClosed());
      
      if (selectedLanguage) {
        // Language was selected, allow navigation
        return true;
      } else {
        // User closed the dialog without selecting, redirect to home or stay
        return false;
      }
    } catch (error) {
      // Handle any errors
      console.error('Error in language selection:', error);
      return false;
    }
  }

  // Language is already selected, allow navigation
  return true;
}; 