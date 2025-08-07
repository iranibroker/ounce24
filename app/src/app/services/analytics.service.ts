import { effect, inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import clarity from '@microsoft/clarity';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private auth = inject(AuthService);

  constructor() {
    if (this.clarityProjectId) {
      clarity.init(this.clarityProjectId);
    }

    effect(() => {
      const user = this.auth.userQuery.data();
      if (this.clarityProjectId && user) {
        clarity.identify(user.id, user.id, undefined, user.title);
      }
    });
  }

  private get clarityProjectId() {
    return environment.clarityProjectId;
  }

  trackEvent(event: string, data?: any) {
    try {
      if (this.clarityProjectId) {
        clarity.event(event);
      }
    } catch (error) {
      console.error(error);
    }
  }
}
