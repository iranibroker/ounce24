import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../services/auth.service';
import { SHARED } from '../../../shared';
import { MatGridListModule } from '@angular/material/grid-list';

@Component({
  selector: 'app-avatar-edit',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatButtonModule,
    SHARED,
    MatGridListModule,
  ],
  templateUrl: './avatar-edit.component.html',
  styleUrls: ['./avatar-edit.component.scss'],
})
export class AvatarEditComponent {
  private authService = inject(AuthService);
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
}
