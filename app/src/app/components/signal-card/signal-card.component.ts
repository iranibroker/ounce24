import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { Signal } from '@ounce24/types';
import { SignalTypeChipComponent } from "../signal-type-chip/signal-type-chip.component";
import { MatDividerModule } from '@angular/material/divider';
import { SHARED } from '../../shared';

@Component({
  selector: 'app-signal-card',
  imports: [CommonModule, MatCardModule, SignalTypeChipComponent, MatDividerModule, SHARED],
  templateUrl: './signal-card.component.html',
  styleUrl: './signal-card.component.scss',
})
export class SignalCardComponent {
  signal = input.required<Signal>();
  Signal = Signal;
}
