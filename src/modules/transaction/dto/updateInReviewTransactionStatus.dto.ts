import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TransactionStatus } from '../../../database';

export class UpdateInReviewTransactionStatusDto {
  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @IsEnum(TransactionStatus)
  @IsNotEmpty()
  status: TransactionStatus;

  @IsString()
  @IsOptional()
  failure_reason?: string;
}
