import { importProvidersFrom } from '@angular/core';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { Observable, from } from 'rxjs';

// Custom TranslateLoader that uses fetch instead of HttpClient
class FetchTranslateLoader implements TranslateLoader {
  constructor(private prefix = './i18n/', private suffix = '.json') {}

  getTranslation(lang: string): Observable<any> {
    const url = `${this.prefix}${lang}${this.suffix}`;
    
    return from(
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load translation file: ${url}`);
          }
          return response.json();
        })
        .catch(error => {
          console.warn(`Translation file not found for language: ${lang}`, error);
          return {};
        })
    );
  }
}

// Get initial language from localStorage
function getInitialLanguage(): string {
  if (typeof window !== 'undefined') {
    const storedLanguage = localStorage.getItem('app_language');
    return storedLanguage || 'en';
  }
  return 'en';
}

const config = TranslateModule.forRoot({
  defaultLanguage: getInitialLanguage(),
  loader: {
    provide: TranslateLoader,
    useClass: FetchTranslateLoader,
  },
});

export function provideTranslation() {
  return importProvidersFrom(config);
}
