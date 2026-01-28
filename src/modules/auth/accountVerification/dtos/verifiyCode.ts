import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, ValidateIf } from 'class-validator';

export class VerifyCodeDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsEmail()
  @ValidateIf((object) => !object.phone_number)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}
