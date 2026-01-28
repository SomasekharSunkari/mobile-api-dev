import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { FiatWalletTransactionType } from '../../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { TransactionStatus } from '../../../database/models/transaction';

export class CreateFiatTransactionDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'txn_123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @ApiProperty({
    description: 'Fiat wallet ID',
    example: 'wallet_123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  fiat_wallet_id: string;

  @ApiProperty({
    description: 'Transaction type',
    enum: FiatWalletTransactionType,
    example: FiatWalletTransactionType.DEPOSIT,
  })
  @IsEnum(FiatWalletTransactionType)
  transaction_type: FiatWalletTransactionType;

  @ApiProperty({
    description: 'Transaction amount',
    example: 1000.5,
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Balance before transaction',
    example: 5000.0,
  })
  @IsNumber()
  @IsOptional()
  balance_before?: number;

  @ApiProperty({
    description: 'Balance after transaction',
    example: 6000.5,
  })
  @IsNumber()
  @IsOptional()
  balance_after?: number;

  @ApiProperty({
    description: 'Transaction currency',
    example: 'USD',
  })
  @IsString()
  currency: string;

  @ApiProperty({
    description: 'Transaction status',
    enum: TransactionStatus,
    example: TransactionStatus.PENDING,
    default: TransactionStatus.PENDING,
  })
  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @ApiPropertyOptional({
    description: 'Provider name',
    example: 'Paystack',
    required: false,
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({
    description: 'Provider reference',
    example: 'pay_123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  provider_reference?: string;

  @ApiPropertyOptional({
    description: 'Provider fee',
    example: 10.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  provider_fee?: number;

  @ApiPropertyOptional({
    description: 'Provider metadata',
    example: { receipt_url: 'https://example.com/receipt/123' },
    required: false,
    type: Object,
  })
  @IsOptional()
  @IsObject()
  provider_metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Source of the transaction',
    example: 'Bank Account',
    required: false,
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'Destination of the transaction',
    example: 'Mobile Wallet',
    required: false,
  })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({
    description: 'Provider quote reference',
    example: 'txn_123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  provider_quote_ref?: string;

  @ApiPropertyOptional({
    description: 'Transaction description',
    example: 'Deposit from bank',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Reason for failure if transaction failed',
    example: 'Insufficient funds',
    required: false,
  })
  @IsOptional()
  @IsString()
  failure_reason?: string;

  @ApiPropertyOptional({
    description: 'Timestamp when transaction was processed',
    example: '2024-06-01T12:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  processed_at?: string;

  @ApiPropertyOptional({
    description: 'Timestamp when transaction was completed',
    example: '2024-06-01T12:05:00Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  completed_at?: string;

  @ApiPropertyOptional({
    description: 'Timestamp when transaction failed',
    example: '2024-06-01T12:10:00Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  failed_at?: string;

  @ApiPropertyOptional({
    description: 'External account ID associated with this transaction',
    example: 'ext_123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  external_account_id?: string;

  @ApiPropertyOptional({
    description: 'Idempotency key to prevent duplicate transaction processing',
    example: 'withdrawal_123e4567',
    required: false,
    maxLength: 40,
  })
  @IsOptional()
  @IsString()
  idempotency_key?: string;
}
