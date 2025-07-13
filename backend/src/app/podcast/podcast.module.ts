import { Module } from '@nestjs/common';
import { PodcastService } from './podcast.service';
import { SchemasModule } from '../schemas/schemas.module';
import { PodcastController } from './podcast.controller';

@Module({
  imports: [SchemasModule],
  providers: [PodcastService],
  controllers: [PodcastController],
  exports: [PodcastService],
})
export class PodcastModule {} 