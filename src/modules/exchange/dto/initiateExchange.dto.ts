import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class InitiateExchangeDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'The currency code' })
  @IsIn(['NGN'])
  from: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'The currency code' })
  @IsIn(['USD'])
  to: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsNotEmpty()
  @Min(0.01)
  @ApiProperty({ description: 'The amount', example: 100.5 })
  amount: number;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'The rate ID' })
  rate_id: string;
}
