import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPinRequestDto {
  @ApiProperty({ description: 'User email for PIN reset' })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
