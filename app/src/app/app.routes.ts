import { Route } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { SignalsComponent } from './pages/signals/list/signals.component';
import { AddSignalComponent } from './pages/signals/add/add-signal.component';
import { SignalInfoComponent } from './pages/signals/info/signal-info.component';
import { loginActivator, translateActivator } from './guards';
import { authRoutes } from './pages/auth/auth.routes';
import { EditUserComponent } from './pages/profile/edit-user/edit-user.component';
import { LeaderboardComponent } from './pages/leaderboard/leaderboard.component';
import { UserProfileComponent } from './pages/profile/user-profile/user-profile.component';

export const appRoutes: Route[] = [
  {
    path: '',
    canActivate: [translateActivator],
    children: [
      {
        path: 'login',
        children: authRoutes,
      },
      {
        path: 'home',
        component: HomeComponent,
      },
      {
        path: 'signals',
        children: [
          {
            path: '',
            component: SignalsComponent,
          },
          {
            path: 'add',
            component: AddSignalComponent,
            canActivate: [loginActivator],
          },
          {
            path: ':id',
            component: SignalInfoComponent,
          },
        ],
      },
      {
        path: 'leaderboard',
        component: LeaderboardComponent,
      },
      {
        path: 'profile',
        children: [
          {
            path: '',
            component: UserProfileComponent,
            canActivate: [loginActivator],
          },
          {
            path: 'edit',
            component: EditUserComponent,
            canActivate: [loginActivator],
          },
          {
            path: ':id',
            component: UserProfileComponent,
          },
        ],
      },
      {
        path: '',
        redirectTo: 'signals',
        pathMatch: 'full',
      },
    ],
  },
];
