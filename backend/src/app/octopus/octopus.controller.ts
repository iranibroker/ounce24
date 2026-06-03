import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OctopusService } from './octopus.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoginUser } from '../auth/user.decorator';
import { Public } from '../auth/public.decorator';
import { OctopusDirection } from '@ounce24/types';

@Controller('octopus')
export class OctopusController {
  constructor(private readonly octopusService: OctopusService) {}

  @Public()
  @Get('config')
  getConfig() {
    return {
      cutoffHour: this.octopusService.getCutoffHourVal(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('vote')
  vote(
    @LoginUser() user: { id: string },
    @Body() body: { direction: OctopusDirection },
  ) {
    if (!body?.direction || !['up', 'down'].includes(body.direction)) {
      throw new BadRequestException('direction must be "up" or "down"');
    }
    return this.octopusService.vote(user.id, body.direction);
  }

  @Public()
  @Get('sentiment')
  getSentiment(@Query('date') dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : undefined;
    return this.octopusService.getSentiment(date);
  }

  @Public()
  @Get('leaderboard/weekly')
  getTopWeekly(@Query('limit') limit?: string) {
    return this.octopusService.getTopWeekly(
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Public()
  @Get('leaderboard/monthly')
  getTopMonthly(@Query('limit') limit?: string) {
    return this.octopusService.getTopMonthly(
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Public()
  @Get('leaderboard/total')
  getTopTotal(@Query('limit') limit?: string) {
    return this.octopusService.getTopTotal(
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/scores')
  getUserScores(@LoginUser() user: { id: string }) {
    return this.octopusService.getUserScores(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/vote')
  getUserVote(
    @LoginUser() user: { id: string },
    @Query('date') dateStr?: string,
  ) {
    const date = dateStr ? new Date(dateStr) : undefined;
    return this.octopusService.getUserVote(user.id, date);
  }
}
