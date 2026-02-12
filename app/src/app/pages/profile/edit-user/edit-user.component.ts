import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../services/auth.service';
import { TelegramService } from '../../../services/telegram.service';
import { injectMutation } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { User } from '@ounce24/types';
import { MatToolbarModule } from '@angular/material/toolbar';
import { SHARED } from '../../../shared';

@Component({
  selector: 'app-edit-user',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatMenuModule,
    MatSnackBarModule,
    TranslateModule,
    MatToolbarModule,
    SHARED,
  ],
  templateUrl: './edit-user.component.html',
  styleUrls: ['./edit-user.component.scss'],
})
export class EditUserComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  auth = inject(AuthService);
  private telegram = inject(TelegramService);

  loading = signal(false);
  form: FormGroup;

  canUseTelegram = () => {
    const user = this.auth.userQuery.data();
    return !!(user?.telegramId || this.telegram.user);
  };

  canUseGoogle = () => this.auth.userQuery.data()?.googleId != null;

  /** True when current avatar is from Telegram or Google (by URL). */
  isExternalAvatar = (): boolean => {
    const avatar = this.auth.userQuery.data()?.avatar;
    if (!avatar) return false;
    return (
      avatar.includes('api.telegram.org') ||
      avatar.includes('googleusercontent.com')
    );
  };

  /** Show menu when there is at least one action (remove or add from Telegram/Google). */
  hasAvatarMenuActions = (): boolean =>
    this.isExternalAvatar() || this.canUseTelegram() || this.canUseGoogle();

  private updateUserMutation = injectMutation<User, Error, Partial<User>>(() => ({
    mutationFn: (body) =>
      this.http.patch<User>('/api/auth/me', body).toPromise(),
    onSuccess: () => {
      this.snack.open(this.translate.instant('profile.edit.success'), '', {
        duration: 2000,
      });
      this.loading.set(false);
    },
    onError: (error: Error) => {
      const err = error as unknown as { error?: { translationKey?: string } };
      if (!err?.error?.translationKey) {
        this.snack.open(this.translate.instant('profile.edit.error'), '', {
          duration: 2000,
        });
      }
      this.loading.set(false);
    },
  }));

  constructor() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      title: [''],
      iban: ['', Validators.pattern('^[0-9]{24}$')],
    });

    effect(() => {
      const user = this.auth.userQuery.data();
      if (user) {
        this.form.patchValue({
          name: user.name,
          title: user.title ?? '',
          iban: user.iban ?? '',
        });
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (!this.form.valid) return;
    this.loading.set(true);
    try {
      await this.updateUserMutation.mutateAsync(this.form.value);
      this.auth.userQuery.refetch();
    } catch (err: unknown) {
      const e = err as { error?: { translationKey?: string } };
      this.snack.open(
        e?.error?.translationKey
          ? this.translate.instant(e.error.translationKey)
          : this.translate.instant('profile.edit.error'),
        '',
        { duration: 2000 }
      );
      this.loading.set(false);
    }
  }

  async removeProfilePhoto(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      await this.http
        .patch<User>('/api/auth/me', { avatar: null, avatarSource: 'bitbots' })
        .toPromise();
      this.auth.userQuery.refetch();
      this.snack.open(
        this.translate.instant('profile.avatar.removed'),
        '',
        { duration: 2000 }
      );
    } catch {
      this.snack.open(
        this.translate.instant('profile.avatar.error'),
        '',
        { duration: 2000 }
      );
    } finally {
      this.loading.set(false);
    }
  }

  async addFromTelegram(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      const tgUser = this.telegram.user;
      if (tgUser?.photo_url) {
        await this.http
          .patch<User>('/api/auth/me', {
            avatar: tgUser.photo_url,
            avatarSource: 'telegram',
          })
          .toPromise();
      } else {
        await this.http
          .post<User>('/api/auth/me/telegram-avatar', {})
          .toPromise();
      }
      this.auth.userQuery.refetch();
      this.snack.open(
        this.translate.instant('profile.avatar.success'),
        '',
        { duration: 2000 }
      );
    } catch (err: unknown) {
      const e = err as { error?: { translationKey?: string } };
      this.snack.open(
        e?.error?.translationKey
          ? this.translate.instant(e.error.translationKey)
          : this.translate.instant('profile.avatar.error'),
        '',
        { duration: 2000 }
      );
    } finally {
      this.loading.set(false);
    }
  }

  async addFromGoogle(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      await this.http.post<User>('/api/auth/me/google-avatar', {}).toPromise();
      this.auth.userQuery.refetch();
      this.snack.open(
        this.translate.instant('profile.avatar.success'),
        '',
        { duration: 2000 }
      );
    } catch (err: unknown) {
      const e = err as { error?: { translationKey?: string } };
      this.snack.open(
        e?.error?.translationKey
          ? this.translate.instant(e.error.translationKey)
          : this.translate.instant('profile.avatar.error'),
        '',
        { duration: 2000 }
      );
    } finally {
      this.loading.set(false);
    }
  }
}
