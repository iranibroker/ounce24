import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AppTokenService {
  private readonly http = inject(HttpClient);

  /**
   * Fetches a short-lived token and returns the full embedded app URL.
   * @param baseUrl - Base URL of the embedded app (e.g. 'https://octopus.ounce24.com')
   */
  async getEmbeddedAppUrl(baseUrl: string): Promise<string> {
    const { token } = await lastValueFrom(
      this.http.get<{ token: string }>('/api/app-token'),
    );

    const url = new URL(baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  /** Fetches a short-lived token only. */
  async getToken(): Promise<string> {
    const { token } = await lastValueFrom(
      this.http.get<{ token: string }>('/api/app-token'),
    );
    return token;
  }
}
