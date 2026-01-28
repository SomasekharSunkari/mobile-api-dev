import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsIn, Min, MaxLength } from 'class-validator';

export class ConvertToCurrencyDto {
  @ApiProperty({
    description: 'The blockchain wallet ID to convert from',
    example: 'wallet_123456789',
  })
  @IsString()
  wallet_id: string;

  @ApiProperty({
    description: 'The amount to convert',
    example: 100.5,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'The target currency to convert to',
    example: 'USD',
    enum: ['USD', 'NGN'],
  })
  @IsString()
  @IsIn(['USD', 'NGN'])
  to_currency: 'USD' | 'NGN';

  @ApiProperty({
    description: 'Optional note for the transaction',
    example: 'Converting USDC to USD for withdrawal',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @ApiProperty({
    description: 'Transaction PIN for security verification',
    example: '123456',
  })
  @IsString()
  pin: string;
}
