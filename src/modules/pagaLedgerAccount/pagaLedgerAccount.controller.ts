import { Body, Controller, Get, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base';
import { Roles } from '../../decorators/Role';
import { ROLES, RolesGuard } from '../auth/guard';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { CreditAccountDto } from './dtos/creditAccount.dto';
import { PagaDashboardAnalyticsDto } from './dtos/pagaDashboardAnalytics.dto';
import { PagaLedgerAccountService } from './pagaLedgerAccount.service';

@ApiTags('Paga Ledger Account')
@Controller('/paga-ledger')
export class PagaLedgerAccountController extends BaseController {
  @Inject(PagaLedgerAccountService)
  private readonly pagaLedgerAccountService: PagaLedgerAccountService;

  @Post('/top-up')
  @ApiOperation({ summary: 'Simulate Paga webhook for testing (non-production only)' })
  @ApiBody({ type: CreditAccountDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paga webhook scheduled successfully',
  })
  async topUp(@Body() body: CreditAccountDto) {
    const result = await this.pagaLedgerAccountService.topUp(body);

    return this.transformResponse(
      'Paga webhook scheduled successfully',
      {
        message: 'Webhook will be sent in 2 seconds',
        result,
        scheduledAt: new Date(Date.now() + 2000).toISOString(),
      },
      HttpStatus.OK,
    );
  }

  @Get('/admin/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.ACTIVE_USER)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get Paga balance reconciliation analytics for admin dashboard',
    description:
      'Returns the actual Paga business account balance, total user NGN balances, and reconciliation metrics. ' +
      'Used by admin to determine if a top-up is needed to cover all user liabilities.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paga dashboard analytics retrieved successfully',
    type: PagaDashboardAnalyticsDto,
  })
  async getDashboardAnalytics() {
    const analytics = await this.pagaLedgerAccountService.getDashboardAnalytics();

    return this.transformResponse('Paga dashboard analytics retrieved successfully', analytics, HttpStatus.OK);
  }

  @Get('/admin/total-balances')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.ACTIVE_USER)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get total user NGN balances across all accounts',
    description:
      'Returns only the sum of all user NGN balances without calling Paga API. ' +
      'Useful for quick internal checks and reconciliation.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Total user balances retrieved successfully',
  })
  async getTotalUserBalances() {
    const balances = await this.pagaLedgerAccountService.getTotalUserBalances();

    return this.transformResponse('Total user balances retrieved successfully', balances, HttpStatus.OK);
  }
}
