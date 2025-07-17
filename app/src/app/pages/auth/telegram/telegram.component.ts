import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { SHARED } from '../../../shared';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';

@Component({
  selector: 'app-telegram',
  imports: [CommonModule, SHARED, EmptyStateComponent],
  templateUrl: './telegram.component.html',
  styleUrl: './telegram.component.scss',
})
export class TelegramComponent {
  queryParams = inject(ActivatedRoute).snapshot.queryParams;
  auth = inject(AuthService);
  router = inject(Router);

  constructor() {
    if (this.queryParams['token']) {
      this.login();
    } else {
      this.router.navigate(['/']);
    }
  }

  async login() {
    try {
      await this.auth.saveToken(this.queryParams['token']);
    } finally {
      this.router.navigate(['/']);
    }
  }
}
