import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAccountActionDto {
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  @ApiProperty({
    type: [String],
    required: true,
    example: ['Reason 1', 'Reason 2'],
    description: 'Reasons for action',
  })
  reasons: string[];

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @ApiProperty({
    type: String,
    required: false,
    example: '@Test123',
    description: 'Password for action',
  })
  password?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @ApiProperty({
    type: String,
    required: false,
    example: 'refresh_token',
    description: 'Refresh token for action',
  })
  refresh_token?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    type: String,
    required: false,
    example: 'email_verification_code',
    description: 'Email verification code for action',
  })
  email_verification_code?: string;
}
