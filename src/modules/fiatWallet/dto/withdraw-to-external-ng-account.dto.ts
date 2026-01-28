import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class WithdrawToExternalNGAccountDto {
  @ApiProperty({ description: 'Amount to withdraw' })
  @IsNotEmpty()
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({ description: 'Country code to withdraw' })
  @IsOptional()
  @IsString()
  @ValidateIf((object) => object.beneficiary_id === null)
  country_code: string;

  @ApiProperty({ description: 'Bank code to withdraw' })
  @IsOptional()
  @ValidateIf((object) => object.beneficiary_id === null)
  @IsString()
  bank_ref: string;

  @ApiProperty({ description: 'Account number to withdraw' })
  @IsOptional()
  @ValidateIf((object) => object.beneficiary_id === null)
  @IsString()
  account_number: string;

  @ApiProperty({ description: 'Beneficiary id to withdraw' })
  @IsOptional()
  @ValidateIf((object) => object.account_number === null)
  @IsString()
  beneficiary_id?: string;

  @ApiProperty({ description: 'Remark for the withdrawal' })
  @IsString()
  remark?: string;
}
