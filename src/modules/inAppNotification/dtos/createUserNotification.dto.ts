import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { IN_APP_NOTIFICATION_TYPE, InAppNotificationType } from '../inAppNotification.enum';

export class CreateInAppNotificationDto {
  @ApiProperty({
    description: 'ID of the user who will receive the notification',
    example: 'b1a2c3d4-5678-90ab-cdef-1234567890ab',
  })
  @IsNotEmpty({ message: 'user_id is required' })
  @IsString({ message: 'user_id must be a string' })
  user_id: string;

  @ApiProperty({
    description: 'Type of the notification',
    enum: IN_APP_NOTIFICATION_TYPE,
    example: IN_APP_NOTIFICATION_TYPE.CREDIT,
  })
  @IsNotEmpty({ message: 'type is required' })
  @IsEnum(IN_APP_NOTIFICATION_TYPE, { message: 'type must be a valid IN_APP_NOTIFICATION_TYPE' })
  type: InAppNotificationType;

  @ApiProperty({
    description: 'Title of the notification',
    example: 'Funds Credited',
  })
  @IsNotEmpty({ message: 'title is required' })
  @IsString({ message: 'title must be a string' })
  title: string;

  @ApiProperty({
    description: 'Notification message body',
    example: 'Your account has been credited with $100.',
  })
  @IsNotEmpty({ message: 'message is required' })
  @IsString({ message: 'message must be a string' })
  message: string;

  @ApiPropertyOptional({
    description: 'Optional metadata for the notification',
    example: { transactionId: 'abc123' },
    type: Object,
  })
  @IsOptional()
  @IsObject({ message: 'metadata must be an object if provided' })
  metadata?: Record<string, any>;
}
