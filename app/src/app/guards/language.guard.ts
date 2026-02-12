import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { LanguageService } from '../services/language.service';

export const languageGuard: CanActivateFn = () => {
  const languageService = inject(LanguageService);
  if (!languageService.hasExplicitLanguageSelection()) {
    languageService.setLanguage('en');
  }
  return true;
}; 