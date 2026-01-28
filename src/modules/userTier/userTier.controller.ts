import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base';
import { UserModel } from '../../database';
import { User } from '../../decorators/User';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { UserTransactionLimitsResponseDto } from './dtos/transactionLimitsResponse.dto';
import { UserTierService } from './userTier.service';

@ApiTags('UserTier')
@Controller('/auth/user-tiers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class UserTierController extends BaseController {
  @Inject(UserTierService)
  private readonly userTierService: UserTierService;

  @Get()
  @ApiOperation({ summary: 'Get current user tier' })
  @ApiResponse({
    status: 200,
    description: 'User tier fetched successfully',
  })
  async getUserTier(@User() user: UserModel) {
    const userTier = await this.userTierService.getUserCurrentTier(user.id);
    return this.transformResponse('User tier fetched successfully', userTier);
  }

  @Get('limits')
  @ApiOperation({ summary: 'Get user transaction limits for all currencies with spent amounts' })
  @ApiResponse({
    status: 200,
    description: 'User transaction limits fetched successfully',
    type: UserTransactionLimitsResponseDto,
  })
  async getUserTransactionLimits(@User() user: UserModel) {
    const limits = await this.userTierService.getUserTransactionLimits(user.id);
    return this.transformResponse('User transaction limits fetched successfully', limits);
  }
}
