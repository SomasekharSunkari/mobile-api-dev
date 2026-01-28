import { Controller, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base/base.controller';
import { Roles } from '../../decorators/Role';
import { ROLES } from '../auth/guard';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { TriggerNgnAccountRetryResponseDto } from './dtos/triggerRetry.dto';
import { NgnAccountRetryService } from './ngnAccountRetry.service';

@ApiTags('NGN Account Retry')
@UseGuards(JwtAuthGuard)
@Roles(ROLES.ADMIN)
@Controller('ngn-account-retry')
export class NgnAccountRetryController extends BaseController {
  @Inject(NgnAccountRetryService)
  private readonly ngnAccountRetryService: NgnAccountRetryService;

  @Post('trigger')
  @ApiOperation({
    summary: 'Trigger NGN account creation retry for eligible users',
    description:
      'Queues a scan job that finds users who have completed KYC (tier >= 1) but do not have an NGN virtual account. Users are processed in chunks of 500 for optimal performance.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'NGN account retry scan job queued successfully',
    type: TriggerNgnAccountRetryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
  })
  async triggerRetry() {
    console.log({ date: new Date().toISOString() });
    const result = await this.ngnAccountRetryService.triggerRetry();
    return this.transformResponse('NGN account retry scan job queued successfully', result);
  }
}
