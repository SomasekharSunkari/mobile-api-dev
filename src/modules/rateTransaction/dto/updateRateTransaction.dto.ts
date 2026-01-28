import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateRateTransactionDto {
  @IsOptional()
  @IsNumber()
  rate?: number;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsNumber()
  converted_amount?: number;

  @IsOptional()
  @IsString()
  expires_at?: string;
}
