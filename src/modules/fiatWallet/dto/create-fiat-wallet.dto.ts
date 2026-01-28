import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { FiatWalletStatus } from '../../../database/models/fiatWallet/fiatWallet.interface';

export class CreateFiatWalletDto {
  @ApiProperty({ description: 'User ID' })
  @IsNotEmpty()
  @IsString()
  user_id: string;

  @ApiProperty({ description: 'Initial balance', default: 0 })
  @IsNumber()
  @Min(0)
  balance: number;

  @ApiProperty({ description: 'Initial credit balance', default: 0 })
  @IsNumber()
  @Min(0)
  credit_balance: number;

  @ApiProperty({ description: 'Asset type (e.g., USD, EUR)' })
  @IsNotEmpty()
  @IsString()
  asset: string;

  @ApiProperty({
    description: 'Wallet status',
    enum: Object.values(FiatWalletStatus),
    default: FiatWalletStatus.ACTIVE,
  })
  @IsNotEmpty()
  @IsString()
  status: FiatWalletStatus;
}
