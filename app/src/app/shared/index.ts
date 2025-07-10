import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { COMMON_DIRECTIVES } from '../directives';
import { COMMON_PIPES } from '../pipes';

export const SHARED = [
  RouterModule,
  TranslateModule,
  COMMON_DIRECTIVES,
  COMMON_PIPES,
];
