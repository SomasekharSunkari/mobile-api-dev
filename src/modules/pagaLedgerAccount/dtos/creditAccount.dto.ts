import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, MaxLength, MinLength } from 'class-validator';

export class CreditAccountDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  account_number: string;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  source_account_number: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  @MinLength(12)
  @MaxLength(30)
  reference_number: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  source_account_name: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  description: string;
}
