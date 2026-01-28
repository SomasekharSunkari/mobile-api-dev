import { ApiProperty } from '@nestjs/swagger';
import { ActivityType } from '../activity.interface';

export class ActivityDetailsResponseDto {
  @ApiProperty({
    description: 'Type of activity',
    enum: ActivityType,
    example: ActivityType.TRANSACTION,
  })
  activity_type: ActivityType;

  @ApiProperty({
    description: 'Complete details from the source table',
    example: {
      id: 'clx123abc456def789',
      user_id: 'clx123abc456def789',
      amount: '10000',
      asset: 'USD',
      status: 'completed',
      transaction_type: 'deposit',
      description: 'Deposited $100.00 USD',
      created_at: '2024-01-15T10:30:00.000Z',
      updated_at: '2024-01-15T10:30:00.000Z',
    },
  })
  details: Record<string, any>;
}
