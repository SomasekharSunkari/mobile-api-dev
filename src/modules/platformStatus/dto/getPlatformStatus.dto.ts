import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetPlatformStatusDto {
  @ApiPropertyOptional({
    description: 'Filter by specific service key',
    example: 'authentication',
  })
  @IsOptional()
  @IsString()
  service_key?: string;
}
