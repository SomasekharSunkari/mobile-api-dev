import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsStrongPassword } from 'class-validator';
import { PASSWORD_CONSTRAINT } from '../../../../constants/constants';
import { Match } from '../../../../decorators/Match';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  old_password: string;

  @ApiProperty()
  @IsString()
  @IsStrongPassword(PASSWORD_CONSTRAINT)
  new_password: string;

  @ApiProperty()
  @IsString()
  @Match('new_password', { message: 'Confirm password did not match' })
  @IsStrongPassword(PASSWORD_CONSTRAINT)
  confirm_new_password: string;
}
