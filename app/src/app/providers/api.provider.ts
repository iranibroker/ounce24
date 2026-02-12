import {
  HTTP_INTERCEPTORS,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpStatusCode,
} from '@angular/common/http';
import { inject, Injectable, Provider } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TelegramService } from '../services/telegram.service';

const JWT_KEY = 'jwtToken';
const IGNORE_CASES = [new RegExp('^https?:\\/\\/?'), new RegExp('/i18n/')];

@Injectable()
class ApiInterceptor implements HttpInterceptor {
  router = inject(Router);
  translate = inject(TranslateService);
  snackBar = inject(MatSnackBar);
  telegramService = inject(TelegramService);
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    let ignore = false;
    for (const cases of IGNORE_CASES) {
      if (cases.test(req.url)) {
        ignore = true;
        break;
      }
    }
    if (!ignore) {
      req = req.clone({
        url: `${environment.apiUrl}${req.url}`,
      });

      const token =
        sessionStorage.getItem(JWT_KEY) || localStorage.getItem(JWT_KEY);

      if (token) {
        if (token) {
          req = req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`,
            },
          });
        }
      }
    }

    return next.handle(req).pipe(
      catchError((err) => {
        console.log(err.error);
        if (err.error?.translationKey) {
          this.translate
            .get(`apiError.${err.error?.translationKey}`, {
              value: err.error?.data,
            })
            .subscribe((res) => {
              this.snackBar.open(res, '', { duration: 2500 });
            });
        }

        if (
          err.status === HttpStatusCode.Unauthorized ||
          err.status === HttpStatusCode.Forbidden
        ) {
          sessionStorage.removeItem(JWT_KEY);
          localStorage.removeItem(JWT_KEY);
          this.router.navigateByUrl(
            this.telegramService.isTelegramApp ? '/login/telegram' : '/login'
          );
        }
        return throwError(err);
      }),
    );
  }
}

export const apiInterceptorProvider: () => Provider = () => ({
  provide: HTTP_INTERCEPTORS,
  useClass: ApiInterceptor,
  multi: true,
});
