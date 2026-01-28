import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class LoginDto {
  @ApiProperty({ required: false, example: 'user@example.com' })
  @ValidateIf((o) => !o.username && !o.phone_number)
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiProperty({ required: false, example: '+1234567890' })
  @ValidateIf((o) => !o.email && !o.username)
  @IsString()
  phone_number?: string;

  @ApiProperty({ required: false, example: 'johndoe' })
  @ValidateIf((o) => !o.email && !o.phone_number)
  @IsString()
  @Transform(({ value }) => value?.toLowerCase().trim())
  username?: string;

  @ApiProperty({ required: true, example: '@Test123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
