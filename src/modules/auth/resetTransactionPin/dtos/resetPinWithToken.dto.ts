import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length, ValidateIf } from 'class-validator';
import { Match } from '../../../../decorators/Match';

export class ResetPinWithTokenDto {
  @ApiProperty({ description: 'Reset token or code sent to user email' })
  @IsOptional()
  @IsString()
  @ValidateIf((object) => !object.verification_token)
  token: string;

  @IsString()
  @IsOptional()
  @ValidateIf((object) => !object.token)
  @ApiProperty({
    type: String,
    required: false,
    example: 'verification_token',
    description: 'Verification token for reset transaction pin',
  })
  verification_token?: string;

  @ApiProperty({
    description: 'PIN must be exactly 6 characters',
    example: 'abc123',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6, { message: 'PIN must be exactly 6 characters' })
  pin: string;

  @ApiProperty({
    description: 'Confirm PIN must match PIN and be exactly 6 characters',
    example: 'abc123',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6, { message: 'Confirm PIN must be exactly 6 characters' })
  @Match('pin', { message: 'New PIN and confirm new PIN must match' })
  confirm_pin: string;
}
