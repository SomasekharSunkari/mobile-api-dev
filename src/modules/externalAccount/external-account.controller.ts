import { Body, Controller, Get, HttpStatus, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BaseController } from '../../base/base.controller';
import { ThrottleGroups } from '../../constants/constants';
import { UserModel } from '../../database/models/user/user.model';
import { User } from '../../decorators/User';
import { RegionalAccessGuard } from '../auth/guard/security-context.guard';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { CreateExternalLinkTokenDto } from './dto/createExternalLinkToken.dto';
import { TransferDto } from './dto/transfer.dto';

import { AccountDeactivationGuard } from '../auth/guard/accountDeactivationGuard/accountDeactivation.guard';
import { TransactionPinGuard } from '../auth/guard/transactionPinGuard/transactionPin.guard';
import { ExternalAccountService } from './external-account.service';

@ApiTags('External Accounts')
@ApiBearerAuth('access_token')
@Controller('/external-accounts')
@UseGuards(JwtAuthGuard)
export class ExternalAccountController extends BaseController {
  @Inject(ExternalAccountService)
  private readonly externalAccountService: ExternalAccountService;

  @Post('link-token')
  @Throttle({ default: ThrottleGroups.STRICT })
  @ApiOperation({
    summary: 'Create a link token for linking a new bank account',
    description:
      'Creates a new Plaid link token for first-time bank account linking. Will fail if user already has an approved account or if account has pending_disconnect status (use link-token-update instead).',
  })
  async createLinkToken(@User() user: UserModel, @Body() body: CreateExternalLinkTokenDto): Promise<any> {
    const result = await this.externalAccountService.createLinkToken(user, body.android_package_name);

    return this.transformResponse('External account link token created successfully', result, HttpStatus.OK);
  }

  @Post('link-token-update')
  @Throttle({ default: ThrottleGroups.DEFAULT })
  @ApiOperation({
    summary: 'Create a link token for updating existing bank account credentials',
    description:
      'Creates a Plaid update link token for fixing existing bank account connections. Use this when account has pending_disconnect status or other authentication issues.',
  })
  async getLinkTokenUpdate(@User() user: UserModel, @Body() body: CreateExternalLinkTokenDto): Promise<any> {
    const result = await this.externalAccountService.getLinkTokenUpdate(user, body.android_package_name);

    return this.transformResponse('Link token update created successfully', result, HttpStatus.OK);
  }

  @Get('')
  @Throttle({ default: ThrottleGroups.DEFAULT })
  @ApiOperation({ summary: 'Get all external accounts' })
  async getExternalAccounts(@User() user: UserModel): Promise<any> {
    const result = await this.externalAccountService.getExternalAccounts(user);

    return this.transformResponse('External accounts fetched successfully', result, HttpStatus.OK);
  }

  @Get(':id')
  @Throttle({ default: ThrottleGroups.DEFAULT })
  @ApiOperation({ summary: 'Get all external accounts' })
  async getExternalAccount(@User() user: UserModel, @Param('id') externalAccountId: string): Promise<any> {
    const result = await this.externalAccountService.getExternalAccount(user, externalAccountId);

    return this.transformResponse('External account fetched successfully', result, HttpStatus.OK);
  }

  @UseGuards(TransactionPinGuard)
  @Post('fund')
  @UseGuards(AccountDeactivationGuard)
  @UseGuards(RegionalAccessGuard)
  @Throttle({ default: ThrottleGroups.STRICT })
  @ApiOperation({ summary: 'Initiate bank → wallet transfer (deposit)' })
  async fund(@User() user: UserModel, @Body() transferRequest: TransferDto): Promise<any> {
    const result = await this.externalAccountService.deposit(user, transferRequest);

    return this.transformResponse(result.message, result, HttpStatus.CREATED);
  }

  @UseGuards(TransactionPinGuard)
  @Post('withdraw')
  @UseGuards(AccountDeactivationGuard)
  @UseGuards(RegionalAccessGuard)
  @Throttle({ default: ThrottleGroups.STRICT })
  @ApiOperation({ summary: 'Initiate wallet → bank transfer (withdrawal)' })
  async withdraw(@User() user: UserModel, @Body() transferRequest: TransferDto): Promise<any> {
    const result = await this.externalAccountService.withdraw(user, transferRequest);

    return this.transformResponse('Withdraw request processed successfully', result, HttpStatus.CREATED);
  }

  @Post('unlink')
  @Throttle({ default: ThrottleGroups.STRICT })
  @ApiOperation({ summary: 'Unlink the connected bank account' })
  async unlinkBankAccount(@User() user: UserModel): Promise<any> {
    const result = await this.externalAccountService.unlinkBankAccount(user);

    return this.transformResponse('Bank account unlinked successfully', result, HttpStatus.OK);
  }
}
