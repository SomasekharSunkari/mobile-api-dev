import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateFeatureFlagDto {
  @ApiPropertyOptional({
    description: 'Description of the feature flag',
    example: 'Enable new dashboard UI redesign',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the feature flag is enabled',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the feature flag is enabled for iOS platform',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled_ios?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the feature flag is enabled for Android platform',
    example: true,
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
