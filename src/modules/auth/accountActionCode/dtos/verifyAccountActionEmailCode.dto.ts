import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class VerifyAccountActionEmailCodeDto {
  @IsString()
  @IsOptional()
  @ApiProperty({
    type: String,
    required: false,
    example: '123456',
    description: 'Email verification code for action',
  })
  code?: string;
}
