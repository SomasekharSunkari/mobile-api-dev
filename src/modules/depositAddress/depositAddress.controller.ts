import { Controller, Get, HttpStatus, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BaseController } from '../../base/base.controller';
import { ThrottleGroups } from '../../constants/constants';
import { UserModel } from '../../database/models/user/user.model';
import { User } from '../../decorators/User';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { DepositAddressService } from './depositAddress.service';

@ApiTags('Deposit Addresses')
@ApiBearerAuth('access-token')
@Controller('/deposit-addresses')
@UseGuards(JwtAuthGuard)
export class DepositAddressController extends BaseController {
  @Inject(DepositAddressService)
  private readonly depositAddressService: DepositAddressService;

  @Get('')
  @Throttle({ default: ThrottleGroups.DEFAULT })
  @ApiOperation({ summary: 'Get all deposit addresses for the authenticated user' })
  async getDepositAddresses(@User() user: UserModel): Promise<any> {
    const result = await this.depositAddressService.getDepositAddresses(user);

    return this.transformResponse(
      'Deposit addresses fetched successfully',
      { deposit_addresses: result },
      HttpStatus.OK,
    );
  }
}
