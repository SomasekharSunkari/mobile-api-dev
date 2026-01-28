import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { RateTransactionType } from '../../../database';

export class GetRateDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'The currency code' })
  currency_code: string;

  @IsEnum(RateTransactionType)
  @IsOptional()
  @ApiProperty({ description: 'The rate type', enum: RateTransactionType, required: false })
  type?: RateTransactionType;

  @IsNumber()
  @IsOptional()
  @ApiProperty({ description: 'The amount' })
  amount?: number;
}
