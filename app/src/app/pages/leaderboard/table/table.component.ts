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
  userCount = input<number>();
  authService = inject(AuthService);

  getSignalsCount(user: User): number {
    const period = this.period();
    if (period === 'week') {
      return user.weekSignals || 0;
    } else if (period === 'month') {
      return user.monthSignals || 0;
    }
    return user.totalSignals || 0;
  }

  getWinSignalsCount(user: User): number {
    const period = this.period();
    if (period === 'week') {
      return user.weekWinSignals || 0;
    } else if (period === 'month') {
      return user.monthWinSignals || 0;
    }
    return Math.round(((user.winRate || 0) * (user.totalSignals || 0)) / 100);
  }

  getLossSignalsCount(user: User): number {
    const period = this.period();
    if (period === 'week') {
      const total = user.weekSignals || 0;
      const wins = user.weekWinSignals || 0;
      return total - wins;
    } else if (period === 'month') {
      const total = user.monthSignals || 0;
      const wins = user.monthWinSignals || 0;
      return total - wins;
    }
    const total = user.totalSignals || 0;
    const wins = this.getWinSignalsCount(user);
    return total - wins;
  }
}
