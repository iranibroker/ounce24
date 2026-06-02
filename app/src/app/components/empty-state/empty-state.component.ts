import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxEmojiSadOutline, saxMicrophoneOutline } from '@ng-icons/iconsax/outline';
import { simpleTelegram } from '@ng-icons/simple-icons';
import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [NgIcon, CommonModule],
  providers: [provideIcons({ saxEmojiSadOutline, saxMicrophoneOutline, simpleTelegram })],
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.scss'],
})
export class EmptyStateComponent {
  iconName = input('');
  icon = input('');
  text = input('');
}
