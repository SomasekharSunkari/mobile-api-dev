import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class GetUploadUrlDto {
  @ApiProperty({ description: 'Content type of the file', required: false, default: 'image/jpeg' })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === null ? undefined : value))
  content_type?: string;
}
