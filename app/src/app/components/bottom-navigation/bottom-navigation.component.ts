import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { SHARED } from '../../shared';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-bottom-navigation',
  imports: [CommonModule, MatToolbarModule, MatButtonModule, SHARED],
  templateUrl: './bottom-navigation.component.html',
  styleUrl: './bottom-navigation.component.scss',
})
export class BottomNavigationComponent {
  authService = inject(AuthService);
}
