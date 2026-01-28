import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FiatWalletTransactionType } from '../../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { TransactionStatus } from '../../../database/models/transaction';

export class FindTransactionsDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({
    description: 'Filter by user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiProperty({
    description: 'Filter by fiat wallet ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  fiat_wallet_id?: string;

  @ApiProperty({
    description: 'Filter by transaction type',
    enum: FiatWalletTransactionType,
    example: FiatWalletTransactionType.DEPOSIT,
    required: false,
  })
  @IsOptional()
  @IsEnum(FiatWalletTransactionType)
  transaction_type?: FiatWalletTransactionType;

  @ApiProperty({
    description: 'Filter by transaction status',
    enum: TransactionStatus,
    example: TransactionStatus.COMPLETED,
    required: false,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiProperty({
    description: 'Filter by currency',
    example: 'USD',
    required: false,
  })
  @IsOptional()
  @IsString()
  currency?: string;
}
