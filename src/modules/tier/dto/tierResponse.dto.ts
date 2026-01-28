import { ApiProperty } from '@nestjs/swagger';
import { TierStatus } from '../../../database/models/tier/tier.interface';

export class TierResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the tier',
    example: 'clx123abc456def789',
  })
  id: string;

  @ApiProperty({
    description: 'Name of the tier',
    example: 'Basic',
  })
  name: string;

  @ApiProperty({
    description: 'Level of the tier (higher level = more privileges)',
    example: 1,
  })
  level: number;

  @ApiProperty({
    description: 'Description of the tier',
    example: 'Basic tier with limited features',
  })
  description: string;

  @ApiProperty({
    description: 'Status of the tier',
    enum: TierStatus,
    example: TierStatus.ACTIVE,
  })
  status: TierStatus;

  @ApiProperty({
    description: 'Date when the tier was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Date when the tier was last updated',
    example: '2024-01-15T10:30:00.000Z',
  })
  updated_at: Date;
}

export class GetAllTiersResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Tiers fetched successfully' })
  message: string;

  @ApiProperty({
    type: [TierResponseDto],
    description: 'List of all tiers in the system',
  })
  data: TierResponseDto[];

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'ISO timestamp of the response',
  })
  timestamp: string;
}
