import { Body, Controller, Get, Inject, Param, Post, Query, Sse, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { IBlockchainResendWebhookRequest } from '../../adapters/blockchain-waas/blockchain-waas-adapter.interface';
import { BaseController } from '../../base/base.controller';
import { IUser } from '../../database/models/user';
import { User } from '../../decorators/User';
import { StreamService } from '../../services/streams/stream.service';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { GetUserTransactionsDto } from '../blockchainWalletTransaction/dto/get-user-transactions.dto';
import { BlockchainWalletService } from './blockchainWallet.service';
import { ConvertToCurrencyDto } from './dto/convert-to-currency.dto';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { EstimateFeeDto } from './dto/estimate-fee.dto';
import { FundFromGasStationDto } from './dto/fund-from-gas-station.dto';
import { InitiateTransactionDto } from './dto/initiate-transaction.dto';

@ApiTags('Blockchain Wallets')
@ApiBearerAuth('access-token')
@Controller('/blockchain-wallets')
@UseGuards(JwtAuthGuard)
export class BlockchainWalletController extends BaseController {
  @Inject(BlockchainWalletService)
  private readonly blockchainWalletService: BlockchainWalletService;

  @Inject(StreamService)
  private readonly streamService: StreamService;

  @Get('supported-currencies')
  @ApiOperation({ summary: 'Get supported stable coins from configuration' })
  @ApiResponse({
    status: 200,
    description: 'Stable coins fetched successfully',
    schema: {
      example: {
        message: 'Stable coins fetched successfully',
        data: [
          {
            id: 'usdc',
            name: 'USD Coin',
            symbol: 'USDC',
            type: 'STABLE_COIN',
            nativeAsset: 'USD',
            imagerl: '/public/images/usdc_erc20.png',
            decimals: 6,
          },
        ],
        statusCode: 200,
      },
    },
  })
  async getSupportedCurrency() {
    const stableCoins = await this.blockchainWalletService.getStableCoins();
    return this.transformResponse('Stable coins fetched successfully', stableCoins);
  }

  @Get('supported-currencies/provider')
  @ApiOperation({ summary: 'Get stable coins from external provider' })
  @ApiResponse({
    status: 200,
    description: 'Stable coins from provider fetched successfully',
    schema: {
      example: {
        message: 'Stable coins from provider fetched successfully',
        data: [
          {
            id: 'usdc',
            name: 'USD Coin',
            symbol: 'USDC',
            type: 'STABLE_COIN',
            nativeAsset: 'USD',
            imageUrl: '/public/images/usdc_erc20.png',
            decimals: 6,
          },
        ],
        statusCode: 200,
      },
    },
  })
  async getSupportedCurrencyFromProvider(@Query('provider') provider?: string) {
    const stableCoins = await this.blockchainWalletService.getStableCoinsFromProvider(provider);
    return this.transformResponse('Stable coins from provider fetched successfully', stableCoins);
  }

  @Post('accounts')
  @ApiOperation({ summary: 'Create a blockchain account for the authenticated user' })
  @ApiResponse({
    status: 201,
    description: 'Account created successfully',
    schema: {
      example: {
        message: 'Account created successfully',
        data: {
          id: 'acc_123456789',
          name: 'john_doe',
          user_id: 'user_123',
        },
        statusCode: 201,
      },
    },
  })
  async createAccount(@User() user: IUser) {
    const account = await this.blockchainWalletService.createBlockchainAccount(user);
    return this.transformResponse('Account created successfully', account);
  }

  @Post('wallets')
  @ApiOperation({ summary: 'Create blockchain wallets for specific assets' })
  @ApiResponse({
    status: 201,
    description: 'Wallet created successfully',
    schema: {
      example: {
        message: 'Wallet created successfully',
        data: {
          successful: [
            {
              asset_id: 'USDC_ETH_TEST5_0GER',
              address: '0x1234567890abcdef...',
              account_id: 'acc_123456789',
              user_id: 'user_123',
            },
          ],
          failed: [],
        },
        statusCode: 201,
      },
    },
  })
  async createWallet(@User() user: IUser, @Body() params: CreateWalletDto) {
    const wallet = await this.blockchainWalletService.createBlockchainWallet(user, params);
    return this.transformResponse('Wallet created successfully', wallet);
  }

  @Get('accounts/me')
  async getVaultAccount(@User() user: IUser) {
    const account = await this.blockchainWalletService.getUserAccount(user);
    return this.transformResponse('Vault account fetched successfully', account);
  }

  @Get('accounts/me/assets/:assetId')
  async getAssetBalance(@User() user: IUser, @Param('assetId') assetId: string) {
    const balance = await this.blockchainWalletService.getWalletBalance(user, assetId);
    return this.transformResponse('Asset balance fetched successfully', balance);
  }

  @Post('fees/estimate')
  async estimateFee(@User() user: IUser, @Body() params: EstimateFeeDto) {
    this.logger.log('bnm,');
    const fee = await this.blockchainWalletService.estimateFee(user, params);
    return this.transformResponse('Fee estimated successfully', fee);
  }

  @Post('transactions/initiate')
  async initiateTransaction(@User() user: IUser, @Body() params: InitiateTransactionDto) {
    const result = await this.blockchainWalletService.initiateTransaction(user, params);
    return this.transformResponse('Transaction initiated successfully', result);
  }

  @Post('convert-to-currency')
  @ApiOperation({ summary: 'Convert blockchain wallet assets to fiat currency (USD or NGN)' })
  @ApiResponse({
    status: 201,
    description: 'Currency conversion initiated successfully',
    schema: {
      example: {
        message: 'Currency conversion initiated successfully',
        data: {
          transactionId: 'txn_123456789',
          status: 'PENDING',
          externalTxId: 'ext_123456789',
          systemMessages: [],
        },
        statusCode: 201,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid wallet, amount, or currency' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Wallet not found or does not belong to user' })
  async convertToCurrency(@User() user: IUser, @Body() params: ConvertToCurrencyDto) {
    const result = await this.blockchainWalletService.convertToCurrency(
      user,
      params.wallet_id,
      params.amount,
      params.to_currency,
      params.note,
    );
    return this.transformResponse('Currency conversion initiated successfully', result);
  }

  @Post('webhooks/resend')
  async resendWebhook(@Body() body: IBlockchainResendWebhookRequest) {
    const result = await this.blockchainWalletService.resendWebhook(body);
    return this.transformResponse('Webhooks resent successfully', result);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get user wallet transactions' })
  @ApiResponse({
    status: 200,
    description: 'User transactions fetched successfully',
    schema: {
      example: {
        message: 'User transactions fetched successfully',
        data: {
          data: [
            {
              id: 'tx_123',
              blockchain_wallet_id: 'wallet_123',
              asset: {
                id: 'USDC_ETH_TEST5_0GER',
                name: 'USD Coin',
                network: 'ETH',
              },
              amount: '100.50',
              balance_before: '0.00',
              balance_after: '100.50',
              transaction_type: 'deposit',
              status: 'completed',
              transaction_scope: 'internal',
              peer_wallet_id: 'wallet_456',
              peer_user: {
                id: 'user_456',
                username: 'jane_doe',
                email: 'jane@example.com',
              },
              created_at: '2024-01-15T10:30:00Z',
            },
          ],
          pagination: {
            total: 1,
            page: 1,
            limit: 10,
            pageCount: 1,
          },
        },
        statusCode: 200,
      },
    },
  })
  async getUserTransactions(
    @User() user: IUser,
    @Query(new ValidationPipe({ transform: true })) query: GetUserTransactionsDto,
  ) {
    const transactions = await this.blockchainWalletService.getUserWalletTransactions(user.id, query);
    return this.transformResponse('User transactions fetched successfully', transactions);
  }

  @Post('wallets/fund-from-gas-station')
  @ApiOperation({ summary: 'Manually fund a blockchain wallet with native gas from gas station' })
  @ApiResponse({
    status: 201,
    description: 'Gas funding transaction initiated',
    schema: {
      example: {
        message: 'Gas funding transaction initiated',
        data: {
          transactionId: 'tx_123456789',
          status: 'SUBMITTED',
          externalTxId: 'ext_123456789',
        },
        statusCode: 201,
      },
    },
  })
  async fundFromGasStation(@User() user: IUser, @Body() body: FundFromGasStationDto) {
    const result = await this.blockchainWalletService.fundWalletFromGasStation(user, {
      wallet_id: body.wallet_id,
      native_asset_id: body.native_asset_id,
      amount: body.amount,
      note: body.note,
    });
    return this.transformResponse('Gas funding transaction initiated', result, 201);
  }

  @Sse('balance/stream')
  @ApiOperation({ summary: 'Stream real-time blockchain wallet balance updates via Server-Sent Events' })
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
  streamBalanceUpdates(@User() user: IUser): Observable<MessageEvent> {
    return this.streamService.getUserBalanceStream(user.id);
  }

  // Test endpoint (temporarily for testing)
  @Post('balance/stream/sample')
  @ApiOperation({ summary: 'Trigger a sample blockchain wallet balance SSE event for testing' })
  @ApiResponse({ status: 201, description: 'Sample balance update event published' })
  async triggerSampleBlockchainBalance(@User() user: IUser) {
    await this.streamService.triggerSampleBalanceUpdate(user.id, 'blockchain');
    return this.transformResponse(
      'Sample balance update event published',
      { stream: 'balance', walletType: 'blockchain' },
      201,
    );
  }
}
