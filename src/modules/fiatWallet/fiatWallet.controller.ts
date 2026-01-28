import { Body, Controller, Get, HttpStatus, Inject, MessageEvent, Param, Post, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Observable } from 'rxjs';
import { BaseController } from '../../base';
import { ThrottleGroups } from '../../constants/constants';
import { UserModel } from '../../database/models/user/user.model';
import { IdempotencyKey } from '../../decorators/IdempotencyKey';
import { User } from '../../decorators/User';
import { StreamService } from '../../services/streams/stream.service';
import { AccountDeactivationGuard } from '../auth/guard/accountDeactivationGuard/accountDeactivation.guard';
import { RegionalAccessGuard } from '../auth/guard/security-context.guard';
import { TransactionPinGuard } from '../auth/guard/transactionPinGuard/transactionPin.guard';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { ExchangeCancelDto } from './dto/exchange-cancel.dto';
import { TransferFiatWalletDto } from './dto/transfer-fiat-wallet.dto';
import { WithdrawToExternalNGAccountDto } from './dto/withdraw-to-external-ng-account.dto';
import { FiatWalletService } from './fiatWallet.service';
import { FiatWalletExchangeService } from './fiatWalletExchange.service';
import { FiatWalletWithdrawalService } from './fiatWalletWithdrawal.service';

@ApiTags('Fiat Wallets')
@Controller('fiat-wallets')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
export class FiatWalletController extends BaseController {
  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  @Inject(FiatWalletWithdrawalService)
  private readonly fiatWalletWithdrawalService: FiatWalletWithdrawalService;

  @Inject(FiatWalletExchangeService)
  private readonly fiatWalletExchangeService: FiatWalletExchangeService;

  @Inject(StreamService)
  private readonly streamService: StreamService;

  @Get(':id')
  @ApiOperation({ summary: 'Get a fiat wallet by ID' })
  @ApiResponse({ status: 200, description: 'Wallet found' })
  async findOne(@User() user: UserModel, @Param('id') id: string) {
    const wallet = await this.fiatWalletService.findById(id, user);
    return this.transformResponse('Fiat wallet fetched successfully', wallet, HttpStatus.OK);
  }

  @Get('')
  @ApiOperation({ summary: 'Get all fiat wallets' })
  @ApiResponse({ status: 200, description: 'Wallets found' })
  async findAll(@User() user: UserModel) {
    const wallets = await this.fiatWalletService.findUserWallets(user.id);
    return this.transformResponse('Fiat wallets fetched successfully', wallets, HttpStatus.OK);
  }

  @Post('transfer')
  @UseGuards(TransactionPinGuard)
  @UseGuards(AccountDeactivationGuard)
  @UseGuards(RegionalAccessGuard)
  @ApiOperation({ summary: 'Transfer funds to another user' })
  @ApiResponse({ status: 200, description: 'Transfer initiated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid transfer request' })
  @ApiResponse({ status: 404, description: 'Recipient user not found' })
  async transfer(@User() user: UserModel, @Body() transferDto: TransferFiatWalletDto) {
    const result = await this.fiatWalletWithdrawalService.transfer(user, transferDto);
    return this.transformResponse('Transfer initiated successfully', result, HttpStatus.CREATED);
  }

  @Post('exchange/cancel')
  @UseGuards(AccountDeactivationGuard)
  @UseGuards(RegionalAccessGuard)
  @ApiOperation({ summary: 'Cancel a pending exchange transaction' })
  @ApiResponse({ status: 200, description: 'Exchange cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid transaction or not in pending status' })
  @ApiResponse({ status: 404, description: 'Exchange transaction not found' })
  async exchangeCancel(@User() user: UserModel, @Body() cancelDto: ExchangeCancelDto) {
    const result = await this.fiatWalletExchangeService.exchangeCancel(user, cancelDto);
    return this.transformResponse('Exchange cancelled successfully', result, HttpStatus.OK);
  }

  /**
   * Withdraw funds to an external Nigerian bank account
   *
   * Security Measures:
   * 1. Rate Limiting: STRICT throttle (2 requests per 10 seconds)
   *    - Prevents brute force attacks and rapid successive withdrawal attempts
   *    - Mitigates race conditions by limiting concurrent requests
   *
   * 2. Transaction PIN Guard: Requires user's transaction PIN
   *    - Ensures user authorization for financial operations
   *    - Prevents unauthorized withdrawals even if session is compromised
   *
   * 3. Idempotency: Requires unique x-idempotency-key header
   *    - Prevents duplicate withdrawals from network retries
   *    - Enables safe retry of failed requests without double-processing
   *    - Each withdrawal must have a unique idempotency key
   *    - Key is provided in header (industry standard practice)
   *
   * 4. Regional Access Guard: Enforces geographic restrictions
   *    - Ensures compliance with regional regulations
   *
   * Request Flow:
   * - Client generates unique idempotency_key for each withdrawal
   * - Request is rate-limited (max 2 per 10 seconds)
   * - Transaction PIN is verified
   * - Balance is reserved immediately (INITIATED status)
   * - External provider is called (PENDING status)
   * - Transaction completes or fails (COMPLETED/FAILED status)
   *
   * Idempotency Behavior:
   * - Same idempotency_key returns existing transaction (if PENDING/COMPLETED)
   * - Same idempotency_key allows retry (if FAILED)
   * - Different idempotency_key creates new transaction
   */
  @Post('withdrawal/external-ng-account')
  @UseGuards(TransactionPinGuard)
  @UseGuards(AccountDeactivationGuard)
  @Throttle({ default: ThrottleGroups.STRICT })
  @ApiOperation({ summary: 'Withdraw funds to an external Nigerian account' })
  @ApiHeader({
    name: 'x-idempotency-key',
    description:
      'Unique idempotency key to prevent duplicate withdrawals. Must be unique per withdrawal request. Max 40 characters.',
    required: true,
    example: 'withdrawal_abc123_1699564800',
  })
  @ApiResponse({ status: 200, description: 'Withdrawal initiated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid withdrawal request or missing idempotency key' })
  @ApiResponse({ status: 404, description: 'User wallet not found' })
  @ApiResponse({ status: 429, description: 'Too many requests - rate limit exceeded' })
  async withdrawalExternalNGAccount(
    @User() user: UserModel,
    @IdempotencyKey() idempotencyKey: string,
    @Body() withdrawDto: WithdrawToExternalNGAccountDto,
  ) {
    const result = await this.fiatWalletWithdrawalService.withdrawToExternalNGAccount(
      user,
      idempotencyKey,
      withdrawDto,
    );

    return this.transformResponse('Withdrawal initiated', result, HttpStatus.CREATED);
  }

  @Sse('balance/stream')
  @ApiOperation({ summary: 'Stream real-time balance updates via Server-Sent Events' })
  @ApiResponse({
    status: 200,
    description: 'SSE connection established for real-time balance updates',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example: 'data: {"type":"connected","timestamp":"2024-01-01T00:00:00.000Z"}\n\n',
        },
      },
    },
  })
  streamBalanceUpdates(@User() user: UserModel): Observable<MessageEvent> {
    return this.streamService.getUserBalanceStream(user.id);
  }

  // Test endpoint (temporarily for testing)
  @Post('balance/stream/sample')
  @ApiOperation({ summary: 'Trigger a sample fiat wallet balance SSE event for testing' })
  @ApiResponse({ status: 201, description: 'Sample balance update event published' })
  async triggerSampleFiatBalance(@User() user: UserModel) {
    await this.streamService.triggerSampleBalanceUpdate(user.id, 'fiat');
    return this.transformResponse(
      'Sample balance update event published',
      { stream: 'balance', walletType: 'fiat' },
      HttpStatus.CREATED,
    );
  }
}
