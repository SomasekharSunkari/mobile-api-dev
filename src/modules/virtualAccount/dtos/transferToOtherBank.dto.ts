import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class TransferToOtherBankDto {
  @IsNotEmpty()
  @IsString()
  account_number: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  bank_name?: string;

  @IsNotEmpty()
  @IsString()
  @IsOptional()
  bank_ref?: string;

  @IsNotEmpty()
  @IsString()
  @IsOptional()
  account_name?: string;
}
