import { Injectable, inject, effect } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { AuthModalComponent } from '../components/auth-modal/auth-modal.component';
import {
  injectMutation,
  injectQuery,
} from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { User } from '@ounce24/types';
const JWT_KEY = 'jwtToken';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  token = signal<string | null>(localStorage.getItem(JWT_KEY));
  private bottomSheet = inject(MatBottomSheet);
  private http = inject(HttpClient);

  constructor() {
    effect(() => {
      const currentToken = this.token();
      if (currentToken) {
        localStorage.setItem(JWT_KEY, currentToken);
      } else {
        localStorage.removeItem(JWT_KEY);
      }
    });
  }

  openAuthModal(): void {
    this.bottomSheet.open(AuthModalComponent, {
      disableClose: true,
    });
  }

  // Token mutation
  sendTokenMutation = injectMutation<void, Error, string>(() => ({
    mutationFn: (token) =>
      this.http.get<void>(`/api/auth/sendToken/${token}`).toPromise(),
  }));

  // Login mutation
  loginMutation = injectMutation<string, Error, { phone: string; otp: string }>(
    () => ({
      mutationFn: (dto) =>
        this.http
          .post(
            `/api/auth/login`,
            {
              username: dto.phone,
              password: dto.otp,
            },
            {
              responseType: 'text',
            },
          )
          .toPromise(),
      onSuccess: async (response) => {
        await this.saveToken(response);
        return response;
      },
    }),
  );

  userQuery = injectQuery<User | null>(() => ({
    queryKey: ['user', this.token()],
    queryFn: () => {
      if (!this.token()) return Promise.resolve(null);
      return this.http.get<User>('/api/auth/me').toPromise();
    },
    retry: false,
    onError: (error) => {
      localStorage.removeItem(JWT_KEY);
      this.token.set(null);
    },
  }));

  async saveToken(token: string) {
    this.token.set(token);
    localStorage.setItem(JWT_KEY, token);
    await this.userQuery.refetch();
  }
}
