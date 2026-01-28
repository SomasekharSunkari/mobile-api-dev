import { Body, Controller, Get, HttpStatus, Inject, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../base/base.controller';
import { TransactionModel, UserModel } from '../../database';
import { Roles } from '../../decorators/Role';
import { User } from '../../decorators/User';
import { ROLES } from '../auth/guard';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { GetTransactionsDto } from './dto/getTransactions.dto';
import { GetTransactionsResponseDto } from './dto/transactionResponse.dto';
import { UpdateInReviewTransactionStatusDto } from './dto/updateInReviewTransactionStatus.dto';
import { TransactionService } from './transaction.service';

@ApiTags('Transactions')
@UseGuards(JwtAuthGuard)
@Controller('transactions')
@ApiBearerAuth('access-token')
export class TransactionController extends BaseController {
  @Inject(TransactionService)
  private readonly transactionService: TransactionService;

  @Get()
  @ApiOperation({ summary: 'Get all transactions with filters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of transactions with external account details',
    type: GetTransactionsResponseDto,
  })
  async findAll(@User() user: UserModel, @Query() query: GetTransactionsDto) {
    const transactions = await this.transactionService.findAll(user.id, query);
    return this.transformResponse('Transactions retrieved successfully', transactions);
  }
  @Patch('review/status')
  @Roles(ROLES.ADMIN, ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update in-review transaction status (Admin only)',
    description: 'Updates the status of an NGN transaction that is in review.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transaction status updated successfully',
    type: TransactionModel,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Transaction not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Transaction is not an NG transaction or not in review status',
  })
  async updateInReviewTransactionStatus(@Body() body: UpdateInReviewTransactionStatusDto) {
    const transaction = await this.transactionService.updateInReviewTransactionStatus(body.transaction_id, body);

    return this.transformResponse('Transaction status updated successfully', transaction, HttpStatus.OK);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Transaction details' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Transaction not found' })
  async findById(@User() user: UserModel, @Param('id') id: string) {
    const transaction = await this.transactionService.findOne({ id, user_id: user.id });
    return this.transformResponse('Transaction retrieved successfully', transaction);
  }
}
