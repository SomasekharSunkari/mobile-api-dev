import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class FundFromGasStationDto {
  @ApiProperty({ description: 'Blockchain wallet ID to fund' })
  @IsUUID()
  wallet_id: string;

  @ApiProperty({
    required: false,
    description: 'Native assetId for the network (e.g., ETH_TEST5). If not provided, uses default stablecoin config',
    example: 'ETH_TEST5',
  })
  @IsOptional()
  @IsString()
  native_asset_id?: string;

  @ApiProperty({ description: 'Amount of native asset to send', example: 0.02 })
  @IsNumber()
  @Min(0.00000001)
  amount: number;

  @ApiProperty({ required: false, description: 'Optional note for the transaction' })
  @IsOptional()
  @IsString()
  note?: string;
}
