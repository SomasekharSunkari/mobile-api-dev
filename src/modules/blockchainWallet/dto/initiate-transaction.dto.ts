import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';
import { FeeType } from '../blockchainWallet.interface';

export class InitiateTransactionDto {
  @ApiProperty({
    description: 'Type of transaction',
    enum: ['internal', 'external'],
    example: 'internal',
  })
  @IsEnum(['internal', 'external'])
  type: FeeType;

  @ApiProperty({
    description: 'Asset ID (e.g., USDC, USDT)',
    example: 'USDC',
  })
  @IsString()
  asset_id: string;

  @ApiProperty({
    description: 'Amount to transfer',
    example: '100',
  })
  @IsNotEmpty()
  @IsNumberString()
  amount: number;

  @ApiPropertyOptional({
    description: 'Destination user ID (for internal transfers only)',
    example: 'user-uuid-123',
  })
  @IsOptional()
  @IsString()
  peer_username?: string;

  @ApiPropertyOptional({
    description: 'Destination address (for external transfers only)',
    example: '0x1234567890abcdef...',
  })
  @IsOptional()
  @IsString()
  peer_address?: string;

  @ApiPropertyOptional({
    description: 'Destination tag (for external transfers, optional)',
    example: '123456',
  })
  @IsOptional()
  @IsString()
  peer_tag?: string;

  @ApiPropertyOptional({
    description: 'Note for the transaction',
    example: 'Payment for invoice #123',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    description: 'Transaction PIN for security verification',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  pin: string;
}
