import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxTrendUpBold, saxTrendDownBold } from '@ng-icons/iconsax/bold';

@Component({
  selector: 'app-octopus-banner',
  standalone: true,
  imports: [CommonModule, TranslateModule, NgIcon],
  providers: [provideIcons({ saxTrendUpBold, saxTrendDownBold })],
  templateUrl: './octopus-banner.component.html',
  styleUrl: './octopus-banner.component.scss',
})
export class OctopusBannerComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  goToOctopus(ev: Event) {
    ev.preventDefault();
    this.router.navigate(['/leaderboard/octopus']);
  }
}
