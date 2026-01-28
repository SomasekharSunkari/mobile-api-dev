import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ExistsIn } from '../../../decorators/ExistsIn';
import { RateRepository } from '../../rate/rate.repository';

export class InitiateCardFundingFromNGNDto {
  @ApiProperty({
    description: 'NGN amount to fund the card with',
    example: 50000,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Exchange rate ID',
    example: 'rate-uuid-123',
  })
  @IsNotEmpty()
  @IsString()
  @ExistsIn(new RateRepository(), 'id', { message: 'Rate not found or expired' })
  rate_id: string;
}
