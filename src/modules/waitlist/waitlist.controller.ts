import { Body, Controller, Get, HttpStatus, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base';
import { UserModel } from '../../database';
import { User } from '../../decorators/User';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { JoinWaitlistDto } from './dto/joinWaitlist.dto';
import { JoinWaitlistResponseDto } from './dto/joinWaitlistResponse.dto';
import { GetUserWaitlistsQueryDto } from './dto/getUserWaitlistsQuery.dto';
import { GetWaitlistOptionsResponseDto } from './dto/getWaitlistOptionsResponse.dto';
import { WaitlistService } from './waitlist.service';

@ApiTags('Waitlist')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('/waitlist')
export class WaitlistController extends BaseController {
  @Inject(WaitlistService)
  private readonly waitlistService: WaitlistService;

  @Post()
  @ApiOperation({ summary: 'Join the waitlist' })
  @ApiBody({ type: JoinWaitlistDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Successfully joined the waitlist',
    type: JoinWaitlistResponseDto,
  })
  async joinWaitlist(@User() user: UserModel, @Body() body: JoinWaitlistDto) {
    const waitlist = await this.waitlistService.joinWaitlist(user.id, user.email, body.reason, body.feature);

    return this.transformResponse('Successfully joined the waitlist', { waitlist }, HttpStatus.CREATED);
  }

  @Get()
  @ApiOperation({ summary: 'Get waitlists the current user has signed up for' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully fetched user waitlists',
  })
  async getUserWaitlists(@User() user: UserModel, @Query() query: GetUserWaitlistsQueryDto) {
    const waitlists = await this.waitlistService.getUserWaitlists(user.id, {
      reason: query.reason,
      feature: query.feature,
    });

    return this.transformResponse('Successfully fetched user waitlists', { waitlists }, HttpStatus.OK);
  }

  @Get('/options')
  @ApiOperation({ summary: 'Get supported waitlist reasons and features' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully fetched waitlist options',
    type: GetWaitlistOptionsResponseDto,
  })
  async getWaitlistOptions() {
    const options = await this.waitlistService.getWaitlistOptions();

    return this.transformResponse('Successfully fetched waitlist options', options, HttpStatus.OK);
  }
}
