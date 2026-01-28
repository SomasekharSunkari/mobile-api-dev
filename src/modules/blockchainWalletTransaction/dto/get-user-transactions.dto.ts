import { IsOptional, IsEnum, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus, TransactionScope } from '../../../database/models/transaction/transaction.interface';

export class GetUserTransactionsDto {
  @ApiProperty({ required: false, enum: ['debit', 'credit'], description: 'Transaction type filter' })
  @IsOptional()
  @IsEnum(['debit', 'credit'])
  type?: 'debit' | 'credit';

  @ApiProperty({ required: false, enum: TransactionStatus, description: 'Transaction status filter' })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiProperty({ required: false, enum: TransactionScope, description: 'Transaction scope filter' })
  @IsOptional()
  @IsEnum(TransactionScope)
  transaction_scope?: TransactionScope;

  @ApiProperty({ required: false, type: Number, description: 'Page number (default: 1)', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, type: Number, description: 'Number of items per page (default: 10)', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({ required: false, type: String, description: 'Specific wallet ID filter' })
  @IsOptional()
  @IsString()
  walletId?: string;
}
