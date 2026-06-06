import { Route } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { SignalsComponent } from './pages/signals/list/signals.component';
import { AddSignalComponent } from './pages/signals/add/add-signal.component';
import { SignalInfoComponent } from './pages/signals/info/signal-info.component';
import { OctopusComponent } from './pages/signals/octopus/octopus.component';
import { loginActivator, translateActivator, languageGuard } from './guards';
import { authRoutes } from './pages/auth/auth.routes';
import { EditUserComponent } from './pages/profile/edit-user/edit-user.component';
import { LeaderboardComponent } from './pages/leaderboard/leaderboard.component';
import { UserProfileComponent } from './pages/profile/user-profile/user-profile.component';
import { AvatarEditComponent } from './pages/profile/avatar-edit/avatar-edit.component';
import { PodcastListComponent } from './pages/podcast/podcast-list/podcast-list.component';
import { MenuComponent } from './pages/menu/menu.component';
import { NotificationSettingsComponent } from './pages/notifications/notification-settings.component';
import { AiSettingsComponent } from './pages/profile/ai-settings/ai-settings.component';
import { MarketComponent } from './pages/market/market.component';

export const appRoutes: Route[] = [
  {
    path: '',
    canActivate: [languageGuard, translateActivator],
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
        path: 'podcast',
        component: PodcastListComponent,
      },
      {
        path: 'signals',
        children: [
          {
            path: '',
            component: SignalsComponent,
          },
          {
            path: 'octopus',
            component: OctopusComponent,
            canActivate: [loginActivator],
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
        path: 'market',
        component: MarketComponent,
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
            path: 'ai-settings',
            component: AiSettingsComponent,
            canActivate: [loginActivator],
          },
          {
            path: 'avatar',
            component: AvatarEditComponent,
            canActivate: [loginActivator],
          },
          {
            path: ':id',
            component: UserProfileComponent,
          },
        ],
      },
      {
        path: 'menu',
        component: MenuComponent,
        canActivate: [loginActivator],
      },
      {
        path: 'notifications',
        component: NotificationSettingsComponent,
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
