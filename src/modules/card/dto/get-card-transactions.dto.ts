import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../base';
import {
  CardTransactionStatus,
  CardTransactionType,
} from '../../../database/models/cardTransaction/cardTransaction.interface';

export class FindCardTransactionsDto extends PaginationDto {
  @ApiProperty({
    description: 'Filter by card ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  card_id?: string;

  @ApiProperty({
    description: 'Filter by transaction type',
    enum: ['reversal', 'spend', 'refund', 'deposit'],
    example: 'spend',
    required: false,
  })
  @IsOptional()
  @IsIn(['reversal', 'spend', 'refund', 'deposit'])
  transaction_type?: CardTransactionType;

  @ApiProperty({
    description: 'Filter by transaction status',
    enum: ['pending', 'declined', 'successful'],
    example: 'successful',
    required: false,
  })
  @IsOptional()
  @IsIn(['pending', 'declined', 'successful'])
  status?: CardTransactionStatus;

  @ApiProperty({
    description: 'Filter by currency',
    example: 'USD',
    required: false,
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Filter by provider reference',
    example: 'ref_123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  provider_reference?: string;

  @ApiProperty({
    description: 'Filter by transaction type (credit or debit)',
    enum: ['credit', 'debit'],
    example: 'debit',
    required: false,
  })
  @IsOptional()
  @IsIn(['credit', 'debit'])
  type?: string;

  @ApiProperty({
    description: 'Filter transactions created on or after this date (YYYY-MM-DD format)',
    example: '2025-01-01',
    required: false,
  })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiProperty({
    description: 'Filter transactions created on or before this date (YYYY-MM-DD format)',
    example: '2025-12-31',
    required: false,
  })
  @IsOptional()
  @IsString()
  end_date?: string;

  @ApiProperty({
    description: 'Search transactions by merchant name',
    example: 'Amazon',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
