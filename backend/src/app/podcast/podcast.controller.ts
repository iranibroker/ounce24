import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { PodcastService } from './podcast.service';

@Controller('podcasts')
export class PodcastController {
  constructor(private readonly podcastService: PodcastService) {}

  @Public()
  @Get()
  async getPodcasts(
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNumber = skip ? parseInt(skip, 10) : 0;
    const limitNumber = limit ? parseInt(limit, 10) : 20;

    return this.podcastService.getPodcasts(skipNumber, limitNumber);
  }
}
