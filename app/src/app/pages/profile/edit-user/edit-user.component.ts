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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../services/auth.service';
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
  private auth = inject(AuthService);

  loading = signal(false);
  form: FormGroup;

  updateUserMutation = injectMutation<User, Error, Partial<User>>(() => ({
    mutationFn: (userData) =>
      this.http.patch<User>('/api/auth/me', userData).toPromise(),
    onSuccess: () => {
      this.snack.open(this.translate.instant('profile.edit.success'), '', {
        duration: 2000,
      });
      this.loading.set(false);
    },
    onError: (error) => {
      this.snack.open(this.translate.instant('profile.edit.error'), '', {
        duration: 2000,
      });
      this.loading.set(false);
    },
  }));

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      title: ['', [Validators.required]],
      iban: ['', [Validators.pattern('^[0-9]{24}$')]],
    });

    // Initialize form with current user data
    effect(() => {
      const user = this.auth.userQuery.data();
      if (user) {
        this.form.patchValue({
          name: user.name,
          title: user.title,
          iban: user.iban,
        });
      }
    });
  }

  async onSubmit() {
    if (this.form.valid) {
      this.loading.set(true);
      await this.updateUserMutation.mutateAsync(this.form.value);
      this.auth.userQuery.refetch();
    }
  }
}
