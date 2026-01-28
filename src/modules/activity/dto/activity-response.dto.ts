import { ApiProperty } from '@nestjs/swagger';
import { ActivityType } from '../activity.interface';

export class ActivityResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the activity',
    example: 'clx123abc456def789',
  })
  id: string;

  @ApiProperty({
    description: 'User ID associated with the activity',
    example: 'clx123abc456def789',
  })
  user_id: string;

  @ApiProperty({
    description: 'Type of activity',
    enum: ActivityType,
    example: ActivityType.TRANSACTION,
  })
  activity_type: ActivityType;

  @ApiProperty({
    description: 'Action performed',
    example: 'deposit',
  })
  action: string;

  @ApiProperty({
    description: 'Human-readable description of the activity',
    example: 'Deposited $100.00 USD to wallet',
  })
  description: string;

  @ApiProperty({
    description: 'Date and time when the activity occurred',
    example: '2024-01-15T10:30:00.000Z',
  })
  activity_date: Date;

  @ApiProperty({
    description: 'Additional metadata for the activity',
    example: {
      amount: '10000',
      asset: 'USD',
      status: 'completed',
    },
  })
  metadata: Record<string, any>;
}

export class GetActivitiesResponseDto {
  @ApiProperty({
    description: 'Array of user activities',
    type: [ActivityResponseDto],
  })
  activities: ActivityResponseDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      previous_page: 0,
      current_page: 1,
      next_page: 2,
      limit: 10,
      page_count: 15,
      total: 150,
    },
  })
  pagination: {
    previous_page: number;
    current_page: number;
    next_page: number;
    limit: number;
    page_count: number;
    total: number;
  };
}
