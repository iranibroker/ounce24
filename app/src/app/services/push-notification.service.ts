import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

const PROMPT_KEY = 'ounce_push_prompted';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private http = inject(HttpClient);
  isSubscribed = signal<boolean>(false);
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        // Register sw.js if it hasn't been registered yet
        this.swRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered successfully:', this.swRegistration);

        // Check if there is an existing subscription
        const subscription = await this.swRegistration.pushManager.getSubscription();
        this.isSubscribed.set(!!subscription);
      } catch (error) {
        console.error('Service Worker registration or subscription check failed:', error);
      }
    } else {
      console.warn('Push notifications or Service Workers are not supported in this browser.');
    }
  }

  hasAskedBefore(): boolean {
    return localStorage.getItem(PROMPT_KEY) === 'true';
  }

  markAsAsked() {
    localStorage.setItem(PROMPT_KEY, 'true');
  }

  async subscribeToNotifications(): Promise<boolean> {
    if (!this.swRegistration) {
      console.error('Service worker registration is not available.');
      return false;
    }

    try {
      // 1. Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied by user.');
        return false;
      }

      // 2. Fetch public VAPID key from backend
      const response = await lastValueFrom(
        this.http.get<{ publicKey: string }>('/api/web-push/vapid-public-key')
      );
      if (!response || !response.publicKey) {
        throw new Error('VAPID public key not returned from server.');
      }

      const applicationServerKey = this.urlBase64ToUint8Array(response.publicKey);

      // 3. Subscribe user to push service
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      });

      // 4. Send subscription details to backend
      await lastValueFrom(this.http.post('/api/web-push/subscribe', subscription));
      
      this.isSubscribed.set(true);
      this.markAsAsked();
      console.log('Successfully subscribed to gold price push notifications.');
      return true;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return false;
    }
  }

  async unsubscribeFromNotifications(): Promise<boolean> {
    if (!this.swRegistration) return false;

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        this.isSubscribed.set(false);
        console.log('Successfully unsubscribed from push notifications.');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
