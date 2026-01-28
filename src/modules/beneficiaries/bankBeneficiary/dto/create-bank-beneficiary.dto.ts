import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateBankBeneficiaryDto {
  @ApiProperty({ description: 'Currency of the beneficiary bank account', example: 'USD' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Alias name of the beneficiary', example: 'Mum Savings' })
  @IsString()
  alias_name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  account_number?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  iban?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  account_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bank_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bank_code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  swift_code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  routing_number?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bank_logo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bank_short_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bank_country?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bank_address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bank_city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bank_state?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bank_zip?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bank_phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bank_email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bank_website?: string;

  @ApiProperty({ required: true })
  @IsString()
  bank_ref?: string;
}
