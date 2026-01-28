import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetSystemConfigsDto {
  @ApiPropertyOptional({
    description: 'Filter by config type (e.g., feature_flag)',
    example: 'feature_flag',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Filter by config key (e.g., minimum_app_version)',
    example: 'minimum_app_version',
  })
  @IsOptional()
  @IsString()
  key?: string;
}
