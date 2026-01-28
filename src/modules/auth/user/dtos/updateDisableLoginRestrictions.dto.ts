import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateDisableLoginRestrictionsDto {
  @ApiProperty({ description: 'Whether to disable login restrictions for the user', example: true })
  @IsBoolean()
  disable_login_restrictions: boolean;
}
