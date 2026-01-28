import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { CardLimitFrequency } from '../../../adapters/card/card.adapter.interface';

export class UpdateCardLimitDto {
  @ApiProperty({
    description: 'Maximum spending amount for the specified frequency',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiProperty({
    description: 'Frequency of the spending limit',
    enum: CardLimitFrequency,
    example: CardLimitFrequency.PER_30_DAY_PERIOD,
    required: false,
  })
  @IsOptional()
  @IsEnum(CardLimitFrequency)
  frequency?: CardLimitFrequency;
}
