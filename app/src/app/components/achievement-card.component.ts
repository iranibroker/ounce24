import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { Achievement } from '@ounce24/types';
import { SHARED } from '../shared';

@Component({
  selector: 'app-achievement-card',
  imports: [CommonModule, MatCardModule, SHARED],
  templateUrl: './achievement-card.component.html',
  styleUrl: './achievement-card.component.scss',
})
export class AchievementCardComponent {
  achievement = input.required<Achievement>();
}
