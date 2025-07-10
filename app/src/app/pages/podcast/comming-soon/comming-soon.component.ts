import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SHARED } from '../../../shared';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-comming-soon',
  imports: [CommonModule, SHARED, EmptyStateComponent, MatButtonModule],
  templateUrl: './comming-soon.component.html',
  styleUrl: './comming-soon.component.scss',
})
export class CommingSoonComponent {}
