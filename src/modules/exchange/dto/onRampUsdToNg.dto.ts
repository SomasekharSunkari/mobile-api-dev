import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class OnRampUsdToNgDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @ApiProperty({
    description: 'The amount of USD to convert to NG',
    example: 100.5,
  })
  amount: number;

  @IsNotEmpty()
  @ApiProperty({
    description: 'The transaction id',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  transaction_id: string;
}
