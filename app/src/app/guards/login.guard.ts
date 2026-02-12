import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TelegramService } from '../services/telegram.service';

export const loginActivator: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const telegramService = inject(TelegramService);

  if (!auth.token()) {
    const queryParams = { returnPath: state.url };
    if (telegramService.isTelegramApp) {
      router.navigate(['/login/telegram'], { queryParams });
    } else {
      router.navigate(['/login'], { queryParams });
    }
    return false;
  }
  return true;
};
