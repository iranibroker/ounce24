import { Route } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { TelegramComponent } from './telegram/telegram.component';

export const authRoutes: Route[] = [
  { path: '', component: LoginComponent },
  { path: 'telegram', component: TelegramComponent },
];
