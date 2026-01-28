import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsStrongPassword } from 'class-validator';
import { PASSWORD_CONSTRAINT } from '../../../../constants/constants';
import { Match } from '../../../../decorators/Match';

export class ResetPasswordDto {
  @ApiProperty()
  @IsStrongPassword(PASSWORD_CONSTRAINT)
  password: string;

  @ApiProperty()
  @Match('password', { message: 'Confirm password did not match' })
  confirm_password: string;

  @ApiProperty()
  @IsString()
  reset_password_token: string;
}
