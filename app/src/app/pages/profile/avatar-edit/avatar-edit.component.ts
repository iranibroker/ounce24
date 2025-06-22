import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../services/auth.service';
import { SHARED } from '../../../shared';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialog } from '@angular/material/dialog';
import { GemRequiredDialogComponent } from '../../../components/gem-required-dialog/gem-required-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { injectMutation } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { User } from '@ounce24/types';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-avatar-edit',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatButtonModule,
    SHARED,
    MatGridListModule,
    MatToolbarModule,
    TranslateModule,
    MatSnackBarModule,
  ],
  templateUrl: './avatar-edit.component.html',
  styleUrls: ['./avatar-edit.component.scss'],
})
export class AvatarEditComponent {
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private translate = inject(TranslateService);
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);
  COLORS = [
    '00acc1',
    '1e88e5',
    '5e35b1',
    '6d4c41',
    '7cb342',
    '8e24aa',
    '039be5',
    '43a047',
    '546e7a',
    '00897b',
    '3949ab',
    '757575',
    'c0ca33',
    'd81b60',
    'e53935',
    'f4511e',
    'fb8c00',
    'fdd835',
    'ffb300',
  ];

  EYES = [
    'bulging',
    'dizzy',
    'eva',
    'frame1',
    'frame2',
    'glow',
    'happy',
    'hearts',
    'robocop',
    'round',
    'roundFrame01',
    'roundFrame02',
    'sensor',
    'shade01',
  ];

  MOUTHS = [
    'bite',
    'diagram',
    'grill01',
    'grill02',
    'grill03',
    'smile01',
    'smile02',
    'square01',
    'square02',
  ];

  selectedColor = signal<string | undefined>(undefined);
  selectedEye = signal<string | undefined>(undefined);
  selectedMouth = signal<string | undefined>(undefined);

  updateAvatarMutation = injectMutation<User, Error, { avatar: string }>(
    () => ({
      mutationFn: (avatarData) =>
        this.http.patch<User>('/api/users/avatar', avatarData).toPromise(),
      onSuccess: () => {
        this.snackBar.open(
          this.translate.instant('profile.avatar.success'),
          '',
          {
            duration: 2000,
          },
        );
        this.authService.userQuery.refetch();
        history.back();
      },
      onError: (error: any) => {
        if (error?.status === 406) {
          this.dialog.open(GemRequiredDialogComponent, {
            width: '400px',
            data: {
              description: this.translate.instant('profile.avatar.noGems'),
            },
          });
        } else {
          this.snackBar.open(
            this.translate.instant('profile.avatar.error'),
            '',
            {
              duration: 2000,
            },
          );
        }
      },
    }),
  );

  onSave() {
    const hasGem = this.authService.userQuery.data()?.gem > 0;
    this.dialog
      .open(GemRequiredDialogComponent, {
        data: {
          description: this.translate.instant(
            hasGem ? 'profile.avatar.useGem' : 'profile.avatar.noGems',
          ),
          accept: hasGem,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          const avatar = this.buildAvatarString();
          if (avatar) {
            this.updateAvatarMutation.mutate({ avatar });
          }
        }
      });
  }

  private buildAvatarString(): string {
    const parts = [];

    if (this.selectedColor()) {
      parts.push(`backgroundColor=${this.selectedColor()}`);
    }
    if (this.selectedEye()) {
      parts.push(`eye=${this.selectedEye()}`);
    }
    if (this.selectedMouth()) {
      parts.push(`mouth=${this.selectedMouth()}`);
    }

    return parts.join('&');
  }
}
