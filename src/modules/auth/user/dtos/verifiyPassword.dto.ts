import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IVerificationType } from '../../../../database';

export class VerifyPasswordDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    type: String,
    required: true,
    example: '@Test123',
    description: 'Password for deactivation',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    type: String,
    required: true,
    example: 'change_password',
    description: 'Verification type',
  })
  verification_type: IVerificationType;
}
