import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

export interface LanguageConfig {
  code: string;
  name: string;
  rtl: boolean;
  flag?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private readonly LANGUAGE_KEY = 'app_language';
  private readonly DEFAULT_LANGUAGE = 'en';

  private currentLanguageSubject = new BehaviorSubject<string>(
    this.DEFAULT_LANGUAGE,
  );
  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  public readonly supportedLanguages: LanguageConfig[] = [
    { code: 'en', name: 'English', rtl: false, flag: '🇺🇸' },
    { code: 'fa', name: 'فارسی', rtl: true, flag: '🇮🇷' },
  ];

  constructor(
    private translateService: TranslateService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    this.initializeLanguage();
  }

  private initializeLanguage(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.setLanguage(this.DEFAULT_LANGUAGE, true);
    }
  }

  private getStoredLanguage(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(this.LANGUAGE_KEY);
    }
    return null;
  }

  private setStoredLanguage(language: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.LANGUAGE_KEY, language);
    }
  }

  public setLanguage(languageCode: string, skipLocalStorage = false): void {
    const languageConfig = this.supportedLanguages.find(
      (lang) => lang.code === languageCode,
    );

    if (languageConfig) {
      // Set language in translate service
      this.translateService.use(languageCode);

      // Store in localStorage
      if (!skipLocalStorage) {
        this.setStoredLanguage(languageCode);
      }

      // Update current language subject
      this.currentLanguageSubject.next(languageCode);

      // Handle RTL
      this.setRTL(languageConfig.rtl);
    }
  }

  public getCurrentLanguage(): string {
    return this.currentLanguageSubject.value;
  }

  public getCurrentLanguageConfig(): LanguageConfig | undefined {
    const currentLang = this.getCurrentLanguage();
    return this.supportedLanguages.find((lang) => lang.code === currentLang);
  }

  public isRTL(): boolean {
    const config = this.getCurrentLanguageConfig();
    return config?.rtl || false;
  }

  private setRTL(isRTL: boolean): void {
    if (isPlatformBrowser(this.platformId)) {
      const htmlElement = document.documentElement;
      const bodyElement = document.body;

      if (isRTL) {
        htmlElement.setAttribute('dir', 'rtl');
        htmlElement.setAttribute('lang', 'fa');
        bodyElement.classList.add('rtl');
        bodyElement.classList.remove('ltr');
      } else {
        htmlElement.setAttribute('dir', 'ltr');
        htmlElement.setAttribute('lang', 'en');
        bodyElement.classList.add('ltr');
        bodyElement.classList.remove('rtl');
      }
    }
  }

  public getSupportedLanguages(): LanguageConfig[] {
    return this.supportedLanguages;
  }

  public hasExplicitLanguageSelection(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(this.LANGUAGE_KEY) !== null;
    }
    return false;
  }
}
