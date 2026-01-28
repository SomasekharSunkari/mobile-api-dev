import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsPhoneNumber, IsString, ValidateIf } from 'class-validator';

export class VerifyResetPasswordCodeDto {
  @IsString()
  @ApiProperty()
  code: string;

  @ApiProperty()
  @IsEmail()
  @ValidateIf((object) => !object.phone)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty()
  @IsPhoneNumber()
  @ValidateIf((object) => !object.email)
  phone?: string;
}
