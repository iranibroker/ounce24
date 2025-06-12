import { Controller, Get, Param, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { Signal, SignalStatus } from '@ounce24/types';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Public } from '../auth/public.decorator';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
  ) {}

  @Public()
  @Get('stats/recalculate')
  async recalculateAllUserStats() {
    // Get all closed signals
    const closedSignals = await this.signalModel.find({
      status: SignalStatus.Closed,
      deletedAt: null,
    });

    // Group signals by owner
    const signalsByOwner = closedSignals.reduce<Record<string, Signal[]>>(
      (acc, signal) => {
        if (!signal.owner) return acc;
        const ownerId = signal.owner.toString();
        if (!acc[ownerId]) {
          acc[ownerId] = [];
        }
        acc[ownerId].push(signal);
        return acc;
      },
      {},
    );

    // Calculate stats for each owner
    const results = await Promise.all(
      Object.entries(signalsByOwner).map(async ([ownerId, signals]) => {
        const owner = signals[0].owner;
        await this.usersService.calculateUserStats(owner);
        return {
          ownerId,
          signalsCount: signals.length,
        };
      }),
    );

    return {
      message: 'User stats recalculated successfully',
      results,
    };
  }

  @Public()
  @Get('leaderboard')
  async getLeaderboard(@Query('userId') userId?: string) {
    return this.usersService.getLeaderboard(0, 30, userId);
  }

  @Public()
  @Get(':id')
  async getUserProfile(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Public()
  @Get(':id/signals')
  async getUserSignals(
    @Param('id') id: string,
    @Query('page') page = 0,
    @Query('limit') limit = 20,
  ) {
    return this.usersService.getUserSignals(id, page, limit);
  }
}
