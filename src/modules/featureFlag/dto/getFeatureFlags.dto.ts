import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { IPlatform, Platform } from '../../../constants/platform';

export class GetFeatureFlagsDto {
  @ApiPropertyOptional({
    description: 'Filter by enabled status',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Platform to filter feature flags (ios, android)',
    example: 'ios',
    enum: Platform,
  })
  @IsOptional()
  @IsEnum(Platform)
  platform?: IPlatform;

  @ApiPropertyOptional({
    description: 'Search by key',
    example: 'dashboard',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
