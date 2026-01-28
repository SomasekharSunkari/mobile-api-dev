import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import {
  TransactionCategory,
  TransactionStatus,
  TransactionType,
  TransactionScope,
} from '../../../database/models/transaction/transaction.interface';

export class CreateTransactionDto {
  @IsNotEmpty()
  @IsString()
  reference: string;

  @IsNotEmpty()
  @IsString()
  asset: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsNumber()
  balance_before: number;

  @IsNotEmpty()
  @IsNumber()
  balance_after: number;

  @IsNotEmpty()
  @IsEnum(TransactionType)
  transaction_type: TransactionType;

  @IsNotEmpty()
  @IsEnum(TransactionCategory)
  category: TransactionCategory;

  @IsNotEmpty()
  @IsEnum(TransactionScope)
  transaction_scope: TransactionScope;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  external_reference?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  @IsString()
  parent_transaction_id?: string;
}
