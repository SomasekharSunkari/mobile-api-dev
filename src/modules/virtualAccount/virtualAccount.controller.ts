import { Controller, Get, HttpStatus, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base';
import { UserModel } from '../../database';
import { VirtualAccountModel } from '../../database/models/virtualAccount';
import { Roles } from '../../decorators/Role';
import { User } from '../../decorators/User';
import { ROLES } from '../auth/guard';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { VirtualAccountQueryDto } from './dtos/virtualAccountQuery.dto';
import { VirtualAccountService } from './virtualAccount.service';

@ApiTags('Virtual Accounts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('/virtual-accounts')
export class VirtualAccountController extends BaseController {
  @Inject(VirtualAccountService)
  private readonly virtualAccountService: VirtualAccountService;

  @Get('')
  @ApiOperation({ summary: 'Fetch the virtual account' })
  @ApiQuery({ name: 'walletId', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Virtual account fetched successfully',
    type: VirtualAccountModel,
  })
  async findAll(@User() user: UserModel, @Query() query: VirtualAccountQueryDto) {
    const virtualAccounts = await this.virtualAccountService.findAll(user.id, query);

    return this.transformResponse('VirtualAccount fetched successfully', virtualAccounts, HttpStatus.OK);
  }

  @Post('exchange/:transactionId')
  @Roles(ROLES.ADMIN)
  @ApiOperation({
    summary: 'Create a new exchange virtual account for a transaction (Admin only)',
    description:
      'Creates a new virtual account on Paga and links it to the specified exchange transaction. ' +
      'Use this when retrying failed exchanges that need a new virtual account.',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'The exchange transaction ID to create a virtual account for',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Exchange virtual account created successfully',
    type: VirtualAccountModel,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Transaction not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Transaction is not an exchange transaction',
  })
  async createExchangeVirtualAccount(@Param('transactionId') transactionId: string) {
    const virtualAccount = await this.virtualAccountService.createExchangeVirtualAccountForTransaction(transactionId);
    return this.transformResponse('Exchange virtual account created successfully', virtualAccount, HttpStatus.CREATED);
  }

  @Get('transaction/:transactionId')
  @Roles(ROLES.ADMIN)
  @ApiOperation({
    summary: 'Get all virtual accounts for a transaction (Admin only)',
    description: 'Returns all virtual accounts linked to the specified transaction.',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'The transaction ID to get virtual accounts for',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Virtual accounts fetched successfully',
    type: [VirtualAccountModel],
  })
  async getVirtualAccountsForTransaction(@Param('transactionId') transactionId: string) {
    const virtualAccounts = await this.virtualAccountService.getVirtualAccountsForTransaction(transactionId);
    return this.transformResponse('Virtual accounts fetched successfully', virtualAccounts, HttpStatus.OK);
  }

  @Post('unschedule-deletion/:virtualAccountId')
  @Roles(ROLES.ADMIN)
  @ApiOperation({
    summary: 'Unschedule deletion for a virtual account (Admin only)',
    description: 'Clears the scheduled_deletion_at timestamp for a virtual account, preventing its deletion.',
  })
  @ApiParam({
    name: 'virtualAccountId',
    description: 'The virtual account ID to unschedule deletion for',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Virtual account deletion unscheduled successfully',
    type: VirtualAccountModel,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Virtual account not found',
  })
  async unscheduleVirtualAccountDeletion(@Param('virtualAccountId') virtualAccountId: string) {
    const virtualAccount = await this.virtualAccountService.unscheduleVirtualAccountDeletion(virtualAccountId);
    return this.transformResponse('Virtual account deletion unscheduled successfully', virtualAccount, HttpStatus.OK);
  }
}
