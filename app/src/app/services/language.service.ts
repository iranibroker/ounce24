import { Injectable, Inject, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';

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
  private readonly DEFAULT_LANGUAGE = 'fa';
  private http = inject(HttpClient);

  private currentLanguageSubject = new BehaviorSubject<string>(
    this.DEFAULT_LANGUAGE,
  );
  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  public readonly supportedLanguages: LanguageConfig[] = [
    { code: 'en', name: 'English', rtl: false, flag: '🇺🇸' },
    { code: 'fa', name: 'فارسی', rtl: true, flag: '🇮🇷' },
    { code: 'ar', name: 'العربية', rtl: true, flag: '🇸🇦' },
    { code: 'tr', name: 'Türkçe', rtl: false, flag: '🇹🇷' },
  ];

  constructor(
    private translateService: TranslateService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {
    this.initializeLanguage();
  }

  private initializeLanguage(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Check query parameters first (e.g. ?lang=fa)
      const urlParams = new URLSearchParams(window.location.search);
      const queryLang = urlParams.get('lang');

      if (queryLang && this.supportedLanguages.some((lang) => lang.code === queryLang)) {
        this.setLanguage(queryLang, false, true);
        return;
      }

      const storedLanguage = this.getStoredLanguage();
      if (storedLanguage && this.supportedLanguages.some((lang) => lang.code === storedLanguage)) {
        this.setLanguage(storedLanguage, false, true);
      } else {
        this.setLanguage(this.DEFAULT_LANGUAGE, true, true);
      }
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

  public setLanguage(
    languageCode: string,
    skipLocalStorage = false,
    skipBackendSync = false,
  ): void {
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

      // Sync to backend if logged in and not skipping backend sync
      if (!skipBackendSync && isPlatformBrowser(this.platformId)) {
        const token = localStorage.getItem('jwtToken');
        if (token) {
          this.http.patch('/api/auth/me', { language: languageCode }).subscribe({
            next: () => console.log('Language synced to backend'),
            error: (err) => console.warn('Failed to sync language to backend', err)
          });
        }
      }
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
      const currentLang = this.getCurrentLanguage();

      htmlElement.setAttribute('lang', currentLang);

      if (isRTL) {
        htmlElement.setAttribute('dir', 'rtl');
        bodyElement.classList.add('rtl');
        bodyElement.classList.remove('ltr');
      } else {
        htmlElement.setAttribute('dir', 'ltr');
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
