import { Component, inject, signal } from '@angular/core';
import { AppTokenService } from '../../services/app-token.service';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

const OCTOPUS_URL = 'https://octopus.ounce24.com';

@Component({
  selector: 'app-octopus-banner',
  standalone: true,
  templateUrl: './octopus-banner.component.html',
  styleUrl: './octopus-banner.component.scss',
})
export class OctopusBannerComponent {
  private appTokenService = inject(AppTokenService);
  auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  loading = signal(false);

  async goToOctopus(ev: Event) {
    ev.preventDefault();
    if (this.loading()) return;

    this.loading.set(true);
    try {
      const url = await this.appTokenService.getEmbeddedAppUrl(OCTOPUS_URL);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      this.snackBar.open('Failed to open Octopus', '', { duration: 2000 });
    } finally {
      this.loading.set(false);
    }
  }
}
