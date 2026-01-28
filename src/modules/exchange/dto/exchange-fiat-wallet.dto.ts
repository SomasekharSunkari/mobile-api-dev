import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ExistsIn } from '../../../decorators/ExistsIn';
import { RateRepository } from '../../rate/rate.repository';

export class ExchangeFiatWalletDto {
  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'The transaction ID', required: false })
  transaction_id?: string;

  @ApiProperty({
    description: 'Source currency',
    enum: ['USD', 'NGN'],
    example: 'USD',
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(['USD', 'NGN'])
  from: string;

  @ApiProperty({
    description: 'Target currency',
    enum: ['USD', 'NGN'],
    example: 'NGN',
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(['USD', 'NGN'])
  to: string;

  @ApiProperty({
    description: 'Amount to exchange',
    example: 100.5,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Rate transaction ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsString()
  @ExistsIn(new RateRepository(), 'id', { message: 'Rate not found or expired' })
  rate_id: string;
}
