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
  Achievement,
} from '@ounce24/types';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Public } from '../auth/public.decorator';
import { LoginUser } from '../auth/user.decorator';
import { AuthService } from '../auth/auth.service';

@Controller('users')
export class UsersController {
  constructor(
    private auth: AuthService,
    private readonly usersService: UsersService,
    @InjectModel(Signal.name) private signalModel: Model<Signal>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(GemLog.name) private gemLogModel: Model<GemLog>,
    @InjectModel(Achievement.name) private achievementModel: Model<Achievement>,
  ) {}

  @Public()
  @Get('stats/recalculate')
  async recalculateAllUserStats() {
    const users = await this.userModel.find({});

    const results = await Promise.all(
      users.map(async (user) => {
        const updatedUser = await this.usersService.calculateUserStats(user);
        return {
          id: user.id,
          name: user.name,
          title: user.title,
          weekScore: updatedUser?.weekScore || 0,
          totalScore: updatedUser?.totalScore || 0,
          score: updatedUser?.score || 0,
          totalSignals: updatedUser?.totalSignals || 0,
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
  @Get('leaderboard/week')
  async getLeaderboardWeek(@Query('userId') userId?: string) {
    return this.usersService.getLeaderboard(0, 30, userId, true);
  }

  @Public()
  @Get(':id')
  async getUserProfile(@Param('id') id: string) {
    return this.auth.getUserInfo(id);
  }

  @Public()
  @Get(':id/achievements')
  async getUserAchievements(
    @Param('id') id: string,
    @Query('page') page = 0,
    @Query('limit') limit = 20,
  ) {
    return this.achievementModel
      .find({ userId: id })
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit);
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
