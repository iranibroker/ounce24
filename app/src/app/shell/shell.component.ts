import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { OuncePriceBannerComponent } from '../components/ounce-price-banner/ounce-price-banner.component';
import { BottomNavigationComponent } from '../components/bottom-navigation/bottom-navigation.component';
import { TopAppBarComponent } from '../components/top-app-bar/top-app-bar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    OuncePriceBannerComponent,
    BottomNavigationComponent,
    TopAppBarComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent {}
