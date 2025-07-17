import { Route } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { OtpComponent } from './otp/otp.component';
import { TelegramComponent } from './telegram/telegram.component';

export const authRoutes: Route[] = [
  { path: '', component: LoginComponent },
  { path: 'otp', component: OtpComponent },
  { path: 'telegram', component: TelegramComponent },
];
