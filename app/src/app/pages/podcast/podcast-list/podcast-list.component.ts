import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { injectInfiniteQuery } from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import { Podcast } from '@ounce24/types';
import { HttpClient } from '@angular/common/http';
import { SHARED } from '../../../shared';

@Component({
  selector: 'app-podcast-list',
  imports: [CommonModule, SHARED],
  templateUrl: './podcast-list.component.html',
  styleUrl: './podcast-list.component.scss',
})
export class PodcastListComponent {
  private readonly http = inject(HttpClient);

  PAGE_SIZE = 20;

  query = injectInfiniteQuery(() => ({
    queryKey: ['podcasts'],
    queryFn: async ({ pageParam }) => {
      return lastValueFrom(
        this.http.get<Podcast[]>('/api/podcasts', {
          params: {
            skip: pageParam * this.PAGE_SIZE,
          },
        }),
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPageData, allPages, lastPage) =>
      lastPageData.length === this.PAGE_SIZE ? lastPage + 1 : null,
    refetchInterval: 30000,
  }));

  data = computed(() => {
    return this.query.data()?.pages?.flat();
  });
}
