import { Controller, Get, Query, UseGuards, Param, Inject, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { BaseController } from '../../base';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { User } from '../../decorators/User';
import { UserModel } from '../../database/models';
import { ActivityService } from './activity.service';
import { GetActivitiesDto, GetActivitiesResponseDto, ActivityDetailsResponseDto } from './dto';

@ApiTags('Activity')
@ApiBearerAuth('access_token')
@Controller('/activities')
@UseGuards(JwtAuthGuard)
export class ActivityController extends BaseController {
  @Inject(ActivityService)
  private readonly activityService: ActivityService;

  @Get()
  @ApiOperation({
    summary: 'Get user activities',
    description:
      'Retrieve paginated list of user activities including transactions, KYC status changes, account management, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'User activities retrieved successfully',
    type: GetActivitiesResponseDto,
  })
  async getUserActivities(@User() user: UserModel, @Query() filters: GetActivitiesDto) {
    const activities = await this.activityService.getUserActivities(user, filters);

    return this.transformResponse('User activities retrieved successfully', activities, HttpStatus.OK);
  }

  @Get(':activityType/:id')
  @ApiOperation({
    summary: 'Get activity details by type and ID',
    description: 'Retrieve detailed information for a specific activity by its type and ID',
  })
  @ApiParam({
    name: 'activityType',
    description: 'Activity type',
    enum: ['transaction', 'kyc_status', 'external_account', 'blockchain_account', 'virtual_account'],
    example: 'transaction',
  })
  @ApiParam({
    name: 'id',
    description: 'Activity ID',
    example: 'clx123abc456def789',
  })
  @ApiResponse({
    status: 200,
    description: 'Activity details retrieved successfully',
    type: ActivityDetailsResponseDto,
  })
  async getActivityDetails(
    @Param('activityType') activityType: string,
    @Param('id') id: string,
    @User() user: UserModel,
  ) {
    const activityDetails = await this.activityService.getActivityDetails(id, activityType, user);

    return this.transformResponse('Activity details retrieved successfully', activityDetails, HttpStatus.OK);
  }
}
