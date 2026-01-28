import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateFeatureFlagOverrideDto {
  @ApiPropertyOptional({
    description: 'Whether the feature is enabled for this user',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Reason for the override',
    example: 'Testing completed',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
