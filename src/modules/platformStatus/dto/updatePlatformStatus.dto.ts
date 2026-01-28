import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PlatformStatusEnum } from '../../../database/models/platformStatus/platformStatus.interface';

export class UpdatePlatformStatusDto {
  @ApiProperty({
    description: 'The new status for the service',
    enum: PlatformStatusEnum,
    example: PlatformStatusEnum.OPERATIONAL,
  })
  @IsEnum(PlatformStatusEnum)
  status: PlatformStatusEnum;

  @ApiPropertyOptional({
    description: 'Custom message to display to users',
    example: 'Scheduled maintenance in progress',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  custom_message?: string;

  @ApiPropertyOptional({
    description: 'Reason for the status change (for audit purposes)',
    example: 'Planned maintenance window',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
