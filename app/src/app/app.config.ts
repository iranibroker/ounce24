import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { apiInterceptorProvider, paginatorIntlProvider, provideTranslation } from './providers';
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { provideIcons } from '@ng-icons/core';
import {
  saxHomeOutline,
  saxActivityOutline,
  saxCupOutline,
  saxUserOutline,
  saxCloseCircleOutline,
  saxCloseSquareOutline,
  saxExportOutline,
  saxStarOutline,
  saxTrendUpOutline,
  saxTrendDownOutline,
  saxJudgeOutline,
  saxClockOutline,
  saxPlayOutline,
  saxStopOutline,
  saxArrowDownOutline,
  saxArrowUpOutline,
  saxArrowLeftOutline,
  saxEditOutline,
  saxInfoCircleOutline,
  saxNotificationOutline,
  saxDiamondsOutline,
  saxEmojiSadOutline,
  saxMicrophoneOutline,
  saxAddOutline,
  saxPercentageCircleOutline,
} from '@ng-icons/iconsax/outline';
import { simpleTelegram } from '@ng-icons/simple-icons';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptorsFromDi()),
    provideTanStackQuery(new QueryClient()),
    apiInterceptorProvider(),
    provideTranslation(),
    paginatorIntlProvider(),
    provideIcons({
      saxHomeOutline,
      saxActivityOutline,
      saxCupOutline,
      saxUserOutline,
      saxCloseCircleOutline,
      saxCloseSquareOutline,
      saxExportOutline,
      saxStarOutline,
      saxTrendUpOutline,
      saxTrendDownOutline,
      saxJudgeOutline,
      saxClockOutline,
      saxPlayOutline,
      saxStopOutline,
      saxArrowDownOutline,
      saxArrowUpOutline,
      saxArrowLeftOutline,
      saxEditOutline,
      saxInfoCircleOutline,
      saxNotificationOutline,
      saxDiamondsOutline,
      saxEmojiSadOutline,
      saxMicrophoneOutline,
      saxAddOutline,
      saxPercentageCircleOutline,
      simpleTelegram,
    }),
  ],
};
