import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AccountDeleteRequestDto {
  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  reasons: string[];
}
