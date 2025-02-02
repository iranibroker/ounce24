import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignalType } from '@ounce24/types';
import { SHARED } from '../../shared';

@Component({
  selector: 'app-signal-type-chip',
  imports: [CommonModule, SHARED],
  templateUrl: './signal-type-chip.component.html',
  styleUrl: './signal-type-chip.component.scss',
})
export class SignalTypeChipComponent {
  type = input.required<SignalType>();
  SignalType = SignalType;
}
