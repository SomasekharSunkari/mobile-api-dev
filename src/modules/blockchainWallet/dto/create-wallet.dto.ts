import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsObject } from 'class-validator';
import { IAssetId } from '../../../adapters/blockchain-waas/blockchain-waas-adapter.interface';

export class CreateWalletDto {
  @ApiProperty({
    description: 'Array of asset IDs to create wallets for',
    example: [
      { asset_id: 'USDC', base_asset_id: 'ETH', name: 'USDC', decimal: 6, type: 'ERC20' },
      { asset_id: 'USDT', name: 'USDT', decimal: 6, type: 'ERC20' },
    ],
    type: 'array',
    items: { type: 'object' },
  })
  @IsArray()
  @IsObject({ each: true })
  asset_ids: IAssetId[];
}
