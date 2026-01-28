import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export enum CardFundRails {
  BLOCKCHAIN = 'blockchain',
  FIAT = 'fiat',
}

export class CardFundDto {
  @ApiProperty({ description: 'Amount to fund the card with (minimum $1.00 in production)' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0.01, { message: 'Amount must be at least 0.01' })
  amount: number;

  @ApiProperty({ enum: CardFundRails, description: 'Funding source type' })
  @IsEnum(CardFundRails, { message: 'Rail must be either blockchain or fiat' })
  rail: CardFundRails;

  @ApiProperty({
    description: 'Transaction PIN for authorization',
    example: '123456',
    required: true,
  })
  @IsNotEmpty({ message: 'Transaction PIN is required' })
  @IsString()
  transaction_pin: string;
}
