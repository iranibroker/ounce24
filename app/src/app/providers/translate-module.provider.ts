import { HttpClient } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './i18n/');
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
    useFactory: HttpLoaderFactory,
    deps: [HttpClient],
  },
});

export function provideTranslation() {
  return importProvidersFrom(config);
}
