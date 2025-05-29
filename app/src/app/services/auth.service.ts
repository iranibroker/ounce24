import { Injectable, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { AuthModalComponent } from '../components/auth-modal/auth-modal.component';
import { injectMutation } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  token = signal<string | null>(null);
  private bottomSheet = inject(MatBottomSheet);
  private http = inject(HttpClient);

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
        this.http.post<string>(`/api/auth/login`, dto).toPromise(),
      onSuccess: (response) => {
        this.token.set(response);
      },
    }),
  );
}
