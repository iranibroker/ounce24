import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { OuncePriceBannerComponent } from '../components/ounce-price-banner/ounce-price-banner.component';
import { BottomNavigationComponent } from '../components/bottom-navigation/bottom-navigation.component';
import { ProductTourComponent } from '../components/product-tour/product-tour.component';
import { TranslateModule } from '@ngx-translate/core';
import { OnInit, OnDestroy } from '@angular/core';
import { TourService } from '../services/tour.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TourStartDialogComponent } from '../components/tour-start-dialog/tour-start-dialog.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    OuncePriceBannerComponent,
    BottomNavigationComponent,
    ProductTourComponent,
    TranslateModule,
    MatDialogModule,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements OnInit, OnDestroy {
  public tourService = inject(TourService);
  private tourTimeout: any = null;
  private dialog = inject(MatDialog);

  ngOnInit() {
    if (typeof window !== 'undefined') {
      const needsTour = localStorage.getItem('ounce24_needs_tour');
      if (needsTour === 'true') {
        this.tourTimeout = setTimeout(() => {
          this.showTourDialog();
        }, 10000);
      }
    }
  }

  showTourDialog() {
    const dialogRef = this.dialog.open(TourStartDialogComponent, {
      width: '400px',
      maxWidth: '95vw',
      panelClass: 'push-notification-dialog-panel',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((accept: boolean) => {
      if (accept) {
        this.tourService.startTour();
      } else {
        localStorage.setItem('ounce24_needs_tour', 'false');
      }
    });
  }

  onTourComplete() {
    this.tourService.completeTour();
  }

  ngOnDestroy() {
    if (this.tourTimeout) {
      clearTimeout(this.tourTimeout);
    }
  }
}
