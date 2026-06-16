import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { Achievement, AchievementType } from '@ounce24/types';
import { SHARED } from '../../shared';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { ACHIEVEMENT_ICONS_MAP, getAchievementIcon, getAchievementClass } from '../../shared/utils/achievement-helper';

@Component({
  selector: 'app-achievement-card',
  imports: [CommonModule, MatCardModule, SHARED, NgIcon],
  providers: [provideIcons(ACHIEVEMENT_ICONS_MAP)],
  templateUrl: './achievement-card.component.html',
  styleUrl: './achievement-card.component.scss',
})
export class AchievementCardComponent {
  achievement = input.required<Achievement>();

  getAchievementIcon(type: AchievementType): string {
    return getAchievementIcon(type);
  }

  getAchievementClass(type: AchievementType): string {
    return getAchievementClass(type);
  }
}
