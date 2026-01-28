import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class CreateAccountDeactivationDto {
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  @ApiProperty({
    type: [String],
    required: true,
    example: ['Reason 1', 'Reason 2'],
    description: 'Reasons for deactivation',
  })
  reasons: string[];

  @IsString()
  @IsOptional()
  @ApiProperty({
    type: String,
    required: false,
    example: 'user-uuid',
    description: 'User ID to restrict (admin only). If not provided, restricts the logged-in user.',
  })
  user_id?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((object) => !object.email_verification_code && !object.user_id)
  @ApiProperty({
    type: String,
    required: false,
    example: 'verification_token',
    description: 'Verification token for self-restriction only. Not required when admin provides user_id.',
  })
  verification_token?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((object) => !object.verification_token && !object.user_id)
  @ApiProperty({
    type: String,
    required: false,
    example: 'email_verification_code',
    description: 'Email verification code for self-restriction only. Not required when admin provides user_id.',
  })
  email_verification_code?: string;
}
