import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { injectInfiniteQuery } from '@tanstack/angular-query-experimental';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Location } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxArrowLeftOutline } from '@ng-icons/iconsax/outline';
import { saxDiamondsBold } from '@ng-icons/iconsax/bold';
import { 
  lucideTrendingUp, 
  lucideTrendingDown, 
  lucideUser, 
  lucideZap, 
  lucideAward, 
  lucideShield, 
  lucideGem 
} from '@ng-icons/lucide';
import { AuthService } from '../../services/auth.service';
import { DataLoadingComponent } from '../../components/data-loading/data-loading.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { SHARED } from '../../shared';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-gems',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatToolbarModule,
    MatTabsModule,
    TranslateModule,
    NgIcon,
    SHARED,
    DataLoadingComponent,
    EmptyStateComponent,
  ],
  providers: [
    provideIcons({
      saxArrowLeftOutline,
      saxDiamondsBold,
      lucideTrendingUp,
      lucideTrendingDown,
      lucideUser,
      lucideZap,
      lucideAward,
      lucideShield,
      lucideGem,
    }),
  ],
  templateUrl: './gems.component.html',
  styleUrls: ['./gems.component.scss'],
})
export class GemsComponent {
  private readonly http = inject(HttpClient);
  private readonly location = inject(Location);
  public readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  user = computed(() => this.auth.userQuery.data());

  historyQuery = injectInfiniteQuery(() => ({
    queryKey: ['gem-history', this.user()?.id],
    queryFn: async ({ pageParam }) => {
      const userId = this.user()?.id;
      if (!userId) return [];
      return lastValueFrom(
        this.http.get<any[]>(`/api/users/${userId}/gems/history`, {
          params: {
            page: pageParam,
            limit: PAGE_SIZE,
          },
        }),
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPageData, allPages, lastPage) =>
      lastPageData.length === PAGE_SIZE ? lastPage + 1 : null,
  }));

  transactions = computed(() => {
    return this.historyQuery.data()?.pages?.flat() || [];
  });

  goBack() {
    this.location.back();
  }

  getActionIcon(action: string): string {
    switch (action) {
      case 'signal_analyze':
        return 'lucideTrendingDown';
      case 'change_avatar':
        return 'lucideUser';
      case 'close_signal':
        return 'lucideTrendingUp';
      case 'generate_signal':
        return 'lucideZap';
      case 'unlock_achievement':
        return 'lucideAward';
      case 'ai_shield_enable':
        return 'lucideShield';
      default:
        return 'lucideGem';
    }
  }

  formatTransactionDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString(
      this.translate.currentLang === 'fa' ? 'fa-IR' : 'en-US',
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  }
}
