import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFeatureFlagOverrideDto {
  @ApiProperty({
    description: 'Feature flag key to override',
    example: 'new_dashboard_ui',
  })
  @IsString()
  @IsNotEmpty()
  feature_flag_id: string;

  @ApiProperty({
    description: 'User ID for the override',
    example: 'clzx1y2z3a4b5c6d7e8f9g0h',
  })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({
    description: 'Whether the feature is enabled for this user',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  enabled: boolean;

  @ApiPropertyOptional({
    description: 'Reason for the override',
    example: 'Beta tester access',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
