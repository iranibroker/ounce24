import { NgIcon, provideIcons } from '@ng-icons/core';
import { simpleTelegram } from '@ng-icons/simple-icons';
import { saxMicrophoneOutline } from '@ng-icons/iconsax/outline';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SHARED } from '../../../shared';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-comming-soon',
  imports: [NgIcon, CommonModule, SHARED, EmptyStateComponent, MatButtonModule],
  providers: [provideIcons({ simpleTelegram, saxMicrophoneOutline })],
  templateUrl: './comming-soon.component.html',
  styleUrl: './comming-soon.component.scss',
})
export class CommingSoonComponent {}
