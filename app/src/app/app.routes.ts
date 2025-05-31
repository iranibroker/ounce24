import { Route } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { SignalsComponent } from './pages/signals/list/signals.component';
import { AddSignalComponent } from './pages/signals/add/add-signal.component';
import { loginActivator, translateActivator } from './guards';
import { authRoutes } from './pages/auth/auth.routes';
import { EditUserComponent } from './pages/profile/edit-user/edit-user.component';
import { LeaderboardComponent } from './pages/leaderboard/leaderboard.component';

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
          }
        ]
      },
      {
        path: 'leaderboard',
        component: LeaderboardComponent,
      },
      {
        path: 'profile',
        component: HomeComponent,
        canActivate: [loginActivator],
      },
      {
        path: 'profile/edit',
        component: EditUserComponent,
        canActivate: [loginActivator],
      },
      {
        path: '',
        redirectTo: 'signals',
        pathMatch: 'full',
      },
    ],
  },
];
