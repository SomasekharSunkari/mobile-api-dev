import { BadRequestException, Body, Controller, HttpStatus, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base';
import { SUPPORTED_CURRENCIES } from '../../currencies';
import { UserModel } from '../../database';
import { Roles } from '../../decorators/Role';
import { User } from '../../decorators/User';
import { RegionalAccessGuard, ROLES } from '../auth/guard';
import { AccountDeactivationGuard } from '../auth/guard/accountDeactivationGuard/accountDeactivation.guard';
import { TransactionPinGuard } from '../auth/guard/transactionPinGuard/transactionPin.guard';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { ExchangeFiatWalletDto } from './dto/exchange-fiat-wallet.dto';
import { RetryExchangeResponseDto } from './dto/retryExchange.dto';
import { ExchangeRetryService } from './exchange-retry.service';
import { FiatExchangeService } from './fiat-exchange/fiat-exchange.service';
import { NgToUsdExchangeService } from './fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.service';

@Controller('exchange')
@ApiTags('Exchange')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
export class ExchangeController extends BaseController {
  @Inject(FiatExchangeService)
  private readonly fiatExchangeService: FiatExchangeService;

  @Inject(NgToUsdExchangeService)
  private readonly ngToUsdExchangeService: NgToUsdExchangeService;

  @Inject(ExchangeRetryService)
  private readonly exchangeRetryService: ExchangeRetryService;

  @UseGuards(RegionalAccessGuard)
  @Post('/fiat/initiate')
  async initiateExchange(@User() user: UserModel, @Body() body: ExchangeFiatWalletDto) {
    const response = await this.ngToUsdExchangeService.initializeNgToUSDExchange(user.id, body);
    return this.transformResponse('Exchange initiated successfully', response);
  }

  @UseGuards(RegionalAccessGuard)
  @UseGuards(AccountDeactivationGuard)
  @UseGuards(TransactionPinGuard)
  @Post('fiat')
  async exchangeFiatWallet(@User() user: UserModel, @Body() body: ExchangeFiatWalletDto) {
    const response = await this.fiatExchangeService.exchange(user, body);
    return this.transformResponse('Fiat wallet exchanged successfully', response);
  }

  @Post('retry/:parentTransactionId')
  @Roles(ROLES.ADMIN)
  @ApiOperation({
    summary: 'Retry a failed USD to NGN exchange transaction (Admin only)',
    description:
      'Creates a new virtual account and re-submits the payout request to YellowCard. ' +
      'Use this when the original virtual account was deleted or had issues.',
  })
  @ApiParam({
    name: 'parentTransactionId',
    description: 'The parent USD transaction ID to retry',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Exchange retry initiated successfully',
    type: RetryExchangeResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Parent transaction not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid transaction type or asset',
  })
  async retryExchange(@Param('parentTransactionId') parentTransactionId: string) {
    const response = await this.exchangeRetryService.retryExchange(parentTransactionId);
    return this.transformResponse('Exchange retry initiated successfully', response);
  }

  /**
   * Validates if the exchange is NGN to USD and throws an error as this feature is under development
   */
  private validateNgnToUsdExchange(from: string, to: string): void {
    const isNgnToUsd =
      from?.toLowerCase() === SUPPORTED_CURRENCIES.NGN.code.toLowerCase() &&
      to?.toLowerCase() === SUPPORTED_CURRENCIES.USD.code.toLowerCase();

    if (isNgnToUsd) {
      throw new BadRequestException('NGN to USD exchange is coming soon! Stay tuned for this exciting feature.');
    }
  }
}
