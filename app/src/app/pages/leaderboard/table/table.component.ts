import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxStarOutline } from '@ng-icons/iconsax/outline';
import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SHARED } from '../../../shared';
import { MatListModule } from '@angular/material/list';
import { AuthService } from '../../../services/auth.service';
import { User } from 'types/src/lib/user';
import { DataLoadingComponent } from '../../../components/data-loading/data-loading.component';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-leaderboard-table',
  imports: [CommonModule,
    SHARED,
    MatListModule,
    DataLoadingComponent,
    MatDividerModule,
    NgIcon],
  providers: [provideIcons({ saxStarOutline })],
  templateUrl: './table.component.html',
  styleUrl: './table.component.scss',
})
export class LeaderboardTableComponent {
  data = input<User[]>();
  period = input<'week' | 'month' | 'total'>('total');
  authService = inject(AuthService);
}
