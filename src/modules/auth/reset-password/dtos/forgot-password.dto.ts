import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsPhoneNumber, ValidateIf } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  @ValidateIf((object) => !object.phone)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiProperty()
  @IsPhoneNumber()
  @ValidateIf((object) => !object.email)
  phone?: string;
}
