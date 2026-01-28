import { IsString } from 'class-validator';

export class VerifyBankAccountDto {
  @IsString()
  account_number: string;

  @IsString()
  bank_ref: string;

  @IsString()
  country_code?: string;
}
