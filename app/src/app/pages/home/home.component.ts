import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Signal } from '@ounce24/types';
import { SignalCardComponent } from '../../components/signal-card/signal-card.component';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { DataLoadingComponent } from '../../components/data-loading/data-loading.component';

@Component({
  selector: 'app-home',
  imports: [CommonModule, SignalCardComponent, DataLoadingComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly http = inject(HttpClient);
  query = injectQuery(() => ({
    queryKey: ['signals'],
    queryFn: () =>
      lastValueFrom(this.http.get<Signal[]>('/api/signals/tempList')),
  }));
}
