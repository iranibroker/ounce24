import { Injectable } from '@angular/core';

declare global {
  interface Window {
    Telegram: any;
  }
}

@Injectable({
  providedIn: 'root',
})
export class TelegramService {
  private tg = window.Telegram?.WebApp;

  get isTelegramApp(): boolean {
    return !!this.tg?.initData;
  }

  get initData(): string {
    return this.tg?.initData || '';
  }

  get user(): any {
    return this.tg?.initDataUnsafe?.user;
  }

  constructor() {
    if (this.isTelegramApp) {
      this.tg.ready();
      this.tg.expand();
    }
  }
}
