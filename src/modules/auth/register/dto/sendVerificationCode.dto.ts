import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class AccountVerificationDto {
  @ApiProperty()
  @IsEmail()
  @Transform(({ value }) => String(value).toLowerCase().trim())
  email: string;
}
