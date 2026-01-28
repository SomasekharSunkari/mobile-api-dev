import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ActivityType } from '../activity.interface';

export class GetActivitiesDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({
    description: 'Filter by activity type(s). Can be a single value or array of values.',
    enum: ActivityType,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsEnum(ActivityType, { each: true })
  activity_type?: ActivityType | ActivityType[];

  @ApiProperty({
    description: 'Filter activities created on or after this date (YYYY-MM-DD format)',
    example: '2025-01-01',
    required: false,
  })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiProperty({
    description: 'Filter activities created on or before this date (YYYY-MM-DD format)',
    example: '2025-12-31',
    required: false,
  })
  @IsOptional()
  @IsString()
  end_date?: string;
}
