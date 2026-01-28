import { Controller, Get, HttpStatus, Inject, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base/base.controller';
import { UserModel } from '../../database';
import { User } from '../../decorators/User';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { FindTransactionsDto } from './dto/find-transactions.dto';
import { FiatWalletTransactionService } from './fiatWalletTransactions.service';

@ApiTags('Fiat Wallet Transactions')
@UseGuards(JwtAuthGuard)
@Controller('fiat-wallet-transactions')
@ApiBearerAuth('access-token')
export class FiatWalletTransactionController extends BaseController {
  @Inject(FiatWalletTransactionService)
  private readonly fiatWalletTransactionService: FiatWalletTransactionService;

  @Get()
  @ApiOperation({ summary: 'Get all fiat wallet transactions with filters' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of fiat wallet transactions' })
  async findAll(@User() user: UserModel, @Query() query: FindTransactionsDto) {
    const transactions = await this.fiatWalletTransactionService.findAll(user.id, query);
    return this.transformResponse('Fiat wallet transactions retrieved successfully', transactions);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a fiat wallet transaction by ID' })
  @ApiParam({ name: 'id', description: 'Fiat wallet transaction ID', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Fiat wallet transaction details' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Fiat wallet transaction not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const transaction = await this.fiatWalletTransactionService.findById(id);
    return this.transformResponse('Fiat wallet transaction retrieved successfully', transaction);
  }
}
