import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxTeacherOutline } from '@ng-icons/iconsax/outline';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-tour-start-dialog',
  templateUrl: './tour-start-dialog.component.html',
  styleUrls: ['./tour-start-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    TranslateModule,
    NgIcon,
  ],
  providers: [
    provideIcons({
      saxTeacherOutline,
    }),
  ],
})
export class TourStartDialogComponent {
  public dialogRef = inject(MatDialogRef<TourStartDialogComponent>);
  private languageService = inject(LanguageService);

  get isRTL(): boolean {
    return this.languageService.isRTL();
  }

  decline() {
    this.dialogRef.close(false);
  }

  accept() {
    this.dialogRef.close(true);
  }
}
