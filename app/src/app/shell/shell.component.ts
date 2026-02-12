import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { OuncePriceBannerComponent } from '../components/ounce-price-banner/ounce-price-banner.component';
import { BottomNavigationComponent } from '../components/bottom-navigation/bottom-navigation.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    OuncePriceBannerComponent,
    BottomNavigationComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent {}
