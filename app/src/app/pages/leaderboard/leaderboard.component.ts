import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '@ounce24/types';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import { DataLoadingComponent } from '../../components/data-loading/data-loading.component';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatIconModule,
    MatDividerModule,
    TranslateModule,
    DataLoadingComponent
  ],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss'
})
export class LeaderboardComponent {
  private readonly http = inject(HttpClient);

  query = injectQuery(() => ({
    queryKey: ['leaderboard'],
    queryFn: () => lastValueFrom(this.http.get<User[]>('/api/users/leaderboard')),
    refetchInterval: 30000
  }));
} 