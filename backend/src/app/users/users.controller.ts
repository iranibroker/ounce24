import {
  Controller,
  Get,
  Param,
  Query,
  Patch,
  Body,
  NotFoundException,
  NotAcceptableException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  GemLog,
  GemLogAction,
  Signal,
  SignalStatus,
  User,
} from '@ounce24/types';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Public } from '../auth/public.decorator';
import { LoginUser } from '../auth/user.decorator';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(GemLog.name) private gemLogModel: Model<GemLog>,
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

  @Patch('avatar')
  async updateUserAvatar(
    @LoginUser() user: User,
    @Body() body: { avatar: string },
  ) {
    // Fetch current user data from database
    const currentUser = await this.userModel.findById(user.id).exec();
    if (!currentUser) {
      throw new NotFoundException({
        translationKey: 'userNotFound',
      });
    }

    // Check if user has gems
    if (!currentUser.gem || currentUser.gem <= 0) {
      throw new NotAcceptableException({
        translationKey: 'insufficientGems',
      });
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        user.id,
        {
          avatar: body.avatar,
          gem: currentUser.gem - 1,
        },
        { new: true },
      )
      .exec();

    this.gemLogModel.create({
      user: user.id,
      gemsChange: -1,
      gemsBefore: currentUser.gem,
      gemsAfter: currentUser.gem - 1,
      action: GemLogAction.ChangeAvatar,
    });

    return updatedUser;
  }
}
