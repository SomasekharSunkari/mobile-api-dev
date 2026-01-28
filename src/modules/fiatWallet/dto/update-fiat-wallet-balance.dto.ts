import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { FiatWalletTransactionType } from '../../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';

export class UpdateFiatWalletBalanceDto {
  @ApiProperty({
    description: 'Amount to update (positive for addition, negative for subtraction)',
    example: 100.5,
  })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Type of transaction',
    enum: FiatWalletTransactionType,
    example: FiatWalletTransactionType.DEPOSIT,
  })
  @IsNotEmpty()
  @IsEnum(FiatWalletTransactionType)
  transaction_type: FiatWalletTransactionType;

  @ApiPropertyOptional({
    description: 'Related transaction ID',
    example: 'trans_12345abcde',
  })
  @IsOptional()
  @IsString()
  transaction_id?: string;

  @ApiPropertyOptional({
    description: 'Description of the transaction',
    example: 'Bank deposit via ABC Bank',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Provider name',
    example: 'BankTransfer',
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({
    description: 'Provider reference ID',
    example: 'ref_98765xyz',
  })
  @IsOptional()
  @IsString()
  provider_reference?: string;

  @ApiPropertyOptional({
    description: 'Provider fee amount',
    example: 1.25,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  provider_fee?: number;

  @ApiPropertyOptional({
    description: 'Provider metadata',
    example: { bankCode: 'ABC123', status: 'confirmed' },
  })
  @IsOptional()
  @IsObject()
  provider_metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Source of funds',
    example: 'Bank Account: *****1234',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'Destination of funds',
    example: 'Fiat Wallet: USD',
  })
  @IsOptional()
  @IsString()
  destination?: string;
}
