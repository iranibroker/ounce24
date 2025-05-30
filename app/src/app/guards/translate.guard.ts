import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

export const translateActivator: CanActivateFn = async (
  next: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const translate = inject(TranslateService);
  await translate.get('menno');
  return true;
};
