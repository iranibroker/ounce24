import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AchievementType } from '@ounce24/types';

@Pipe({
  name: 'achievementType',
})
export class AchievementTypePipe implements PipeTransform {
  private translate = inject(TranslateService);
  transform(value?: AchievementType, ...args: unknown[]): string {
    return this.translate.instant(`achievement.type.${value}`);
  }
}
