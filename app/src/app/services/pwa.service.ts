import { Injectable, signal, computed, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { TelegramService } from './telegram.service';

const PWA_PROMPT_KEY = 'ounce_pwa_prompted';

@Injectable({
  providedIn: 'root',
})
export class PwaService {
  private telegramService = inject(TelegramService);
  private deferredPrompt: any = null;
  isInstallable = signal<boolean>(false);
  isStandalone = signal<boolean>(
    window.matchMedia('(display-mode: standalone)').matches || !!(navigator as any).standalone
  );

  constructor() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      this.deferredPrompt = e;
      this.isInstallable.set(true);
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.isStandalone.set(true);
      this.isInstallable.set(false);
      this.deferredPrompt = null;
    });
  }

  isPwaSupported(): boolean {
    if (this.telegramService.isTelegramApp) {
      return false;
    }
    if (!environment.production) {
      return true;
    }
    // Supports service worker and not standalone
    return 'serviceWorker' in navigator && !this.isStandalone();
  }

  hasAskedBefore(): boolean {
    return localStorage.getItem(PWA_PROMPT_KEY) === 'true';
  }

  markAsAsked() {
    localStorage.setItem(PWA_PROMPT_KEY, 'true');
  }

  isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }

  async install(): Promise<boolean> {
    if (!this.deferredPrompt) {
      if (!environment.production) {
        console.log('Dev mode: Simulated PWA Install successfully.');
        return true;
      }
      return false;
    }
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.isInstallable.set(false);
    return outcome === 'accepted';
  }
}
