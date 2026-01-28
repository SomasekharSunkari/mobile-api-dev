import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { RateTransactionType } from '../../../database';

export class CreateRateTransactionDto {
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsString()
  currency: string;

  @IsNotEmpty()
  @IsEnum(RateTransactionType)
  type: RateTransactionType;

  @IsNotEmpty()
  @IsString()
  transaction_id: string;
}
