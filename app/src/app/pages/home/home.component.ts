import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Signal, SignalStatus, SignalType, User } from '@ounce24/types';
import { SignalCardComponent } from '../../components/signal-card/signal-card.component';

const SIGNALS: Signal[] = [
  {
    type: SignalType.Sell,
    minPrice: 2034,
    maxPrice: 2085,
    entryPrice: 2038,
    status: SignalStatus.Pending,
    owner: {
      title: 'dmc_3349',
    },
  } as Signal,
  {
    type: SignalType.Sell,
    minPrice: 2034,
    maxPrice: 2085,
    entryPrice: 2038,
    status: SignalStatus.Pending,
    owner: {
      title: 'ali394',
    } as User,
  } as Signal,
  {
    type: SignalType.Buy,
    minPrice: 2034,
    maxPrice: 2085,
    entryPrice: 2038,
    status: SignalStatus.Pending,
    owner: {
      title: 'moh.dmci3',
    } as User,
  } as Signal,
  {
    type: SignalType.Sell,
    minPrice: 2034,
    maxPrice: 2085,
    entryPrice: 2038,
    status: SignalStatus.Pending,
    owner: {
      title: 'amir22',
    } as User,
  } as Signal,
];

@Component({
  selector: 'app-home',
  imports: [CommonModule, SignalCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  signals = signal<Signal[]>(SIGNALS);
}
