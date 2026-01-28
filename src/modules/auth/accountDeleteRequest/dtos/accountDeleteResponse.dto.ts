import { ApiProperty } from '@nestjs/swagger';

export class AccountDeleteResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'AccountDeleteRequest Successfully Created' })
  message: string;

  @ApiProperty({ example: 'uuid-abc-123' })
  id: string;

  @ApiProperty({ example: 'dont use the app' })
  reason: string;

  @ApiProperty({ example: 'uuid-user-123' })
  user_id: string;

  @ApiProperty({ example: '2025-05-05T15:30:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2025-05-06T03:21:53.611Z' })
  timestamp: string;
}
