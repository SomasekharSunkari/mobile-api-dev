import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFeatureFlagDto {
  @ApiProperty({
    description: 'Unique key for the feature flag',
    example: 'new_dashboard_ui',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  key: string;

  @ApiPropertyOptional({
    description: 'Description of the feature flag',
    example: 'Enable new dashboard UI redesign',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Whether the feature flag is enabled',
    example: false,
    default: false,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({
    description: 'Whether the feature flag is enabled for iOS platform',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled_ios?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the feature flag is enabled for Android platform',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled_android?: boolean;

  @ApiPropertyOptional({
    description: 'Expiration date for the feature flag',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}
