import { IsOptional, IsString } from 'class-validator';

export class BankQueryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  countryCode?: string;
}
