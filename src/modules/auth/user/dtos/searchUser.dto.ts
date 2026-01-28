import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SearchUserDto {
  @ApiProperty({
    description: 'Search term to search across user fields',
    example: 'john',
    required: true,
  })
  @IsString({
    message: 'Search term must be present',
  })
  search: string;

  @ApiProperty({
    description: 'Filter by asset',
    example: 'USDC',
    required: false,
  })
  @IsOptional()
  @IsString()
  asset?: string;

  @ApiProperty({
    description: 'Filter by network',
    example: 'ethereum',
    required: false,
  })
  @IsOptional()
  @IsString()
  network?: string;

  @ApiProperty({
    description: 'Filter by wallet ID',
    example: 'cmfl2bzq40000l3mi6amqef62',
    required: false,
  })
  @IsOptional()
  @IsString()
  wallet_id?: string;
}
