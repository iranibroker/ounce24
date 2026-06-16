import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxClockOutline, saxStarOutline } from '@ng-icons/iconsax/outline';
import { saxTrendUpBold, saxTrendDownBold } from '@ng-icons/iconsax/bold';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { AuthService } from '../../services/auth.service';
import { DataLoadingComponent } from '../data-loading/data-loading.component';

@Component({
  selector: 'app-octopus-history-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatListModule,
    MatButtonModule,
    MatDividerModule,
    TranslateModule,
    NgIcon,
    DataLoadingComponent,
  ],
  providers: [
    provideIcons({
      saxClockOutline,
      saxStarOutline,
      saxTrendUpBold,
      saxTrendDownBold,
    }),
  ],
  templateUrl: './octopus-history-dialog.component.html',
  styleUrl: './octopus-history-dialog.component.scss',
})
export class OctopusHistoryDialogComponent {
  private readonly http = inject(HttpClient);
  public readonly authService = inject(AuthService);
  public readonly dialogRef = inject(MatDialogRef<OctopusHistoryDialogComponent>);

  historyQuery = injectQuery(() => {
    const user = this.authService.userQuery.data();
    return {
      queryKey: ['octopusHistory', user?.id, 10],
      queryFn: () =>
        lastValueFrom(
          this.http.get<any[]>('/api/octopus/me/history', {
            params: { page: 0, limit: 10 },
          })
        ),
      enabled: !!user?.id,
    };
  });

  onClose(): void {
    this.dialogRef.close();
  }
}
