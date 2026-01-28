import { IsOptional, IsString } from 'class-validator';

export class CreateVirtualAccountDto {
  @IsString()
  @IsOptional()
  bvn?: string;

  @IsString()
  @IsOptional()
  fiat_wallet_id?: string;

  @IsString()
  @IsOptional()
  transaction_id?: string;
}
