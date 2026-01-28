import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateExternalLinkTokenDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  android_package_name?: string;
}
