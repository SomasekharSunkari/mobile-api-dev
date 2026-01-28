import { Body, Controller, Get, Inject, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base';
import { PaginationDto } from '../../base/base.dto';
import { UserModel } from '../../database/models/user/user.model';
import { User } from '../../decorators/User';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { DoshPointsAccountService } from './doshPointsAccount/doshPointsAccount.service';
import { DoshPointsStablecoinRewardService } from './doshPointsStablecoinReward/doshPointsStablecoinReward.service';
import { DoshPointsTransactionService } from './doshPointsTransaction/doshPointsTransaction.service';
import { UpdateUsdFiatRewardsEnabledDto } from './dto/updateUsdFiatRewardsEnabled.dto';

@ApiTags('Dosh Points')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('/dosh-points')
export class DoshPointsController extends BaseController {
  @Inject(DoshPointsAccountService)
  private readonly doshPointsAccountService: DoshPointsAccountService;

  @Inject(DoshPointsTransactionService)
  private readonly doshPointsTransactionService: DoshPointsTransactionService;

  @Inject(DoshPointsStablecoinRewardService)
  private readonly doshPointsStablecoinRewardService: DoshPointsStablecoinRewardService;

  @Get('/account')
  @ApiOperation({ summary: 'Get user Dosh Points account' })
  @ApiResponse({
    status: 200,
    description: 'Dosh Points account retrieved successfully',
  })
  async getAccount(@User() user: UserModel) {
    const account = await this.doshPointsAccountService.findOrCreate(user.id);
    return this.transformResponse('Dosh Points account retrieved successfully', account);
  }

  @Get('/transactions')
  @ApiOperation({ summary: 'Get user Dosh Points transaction history' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiResponse({
    status: 200,
    description: 'Dosh Points transactions retrieved successfully',
  })
  async getTransactions(@User() user: UserModel, @Query() pagination: PaginationDto) {
    const transactions = await this.doshPointsTransactionService.getTransactionHistory(user.id, pagination);
    return this.transformResponse('Dosh Points transactions retrieved successfully', transactions);
  }

  @Patch('/usd-fiat-rewards-enabled')
  @ApiOperation({ summary: 'Enable or disable USD stablecoin rewards (first deposit match only on first opt-in)' })
  @ApiResponse({
    status: 200,
    description: 'USD fiat rewards preference updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request',
  })
  async updateUsdFiatRewardsEnabled(@User() user: UserModel, @Body() body: UpdateUsdFiatRewardsEnabledDto) {
    const result = await this.doshPointsStablecoinRewardService.handleOptIn(user.id, body.enabled);
    return this.transformResponse(result.message, result);
  }
}
