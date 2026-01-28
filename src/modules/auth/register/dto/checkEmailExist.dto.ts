import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';

export class CheckEmailDto {
  @ApiProperty()
  @IsString()
  @IsEmail()
  @Transform(({ value }) => String(value).toLowerCase().trim())
  email: string;
}
