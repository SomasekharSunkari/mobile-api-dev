import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsISO31661Alpha2,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  ValidateIf,
} from 'class-validator';
import { PASSWORD_CONSTRAINT } from '../../../../constants/constants';
import { Match } from '../../../../decorators/Match';
import { NoSpaces } from '../../../../decorators/NoSpaces';

export class RegisterDto {
  @ApiProperty({
    type: String,
    required: true,
    example: 'email@test.com',
    description: 'User email',
  })
  @IsEmail()
  @ValidateIf((object) => !object.phone_number)
  @IsNotEmpty()
  @Transform(({ value }) => String(value).toLowerCase().trim())
  email: string;

  @ApiProperty({
    type: String,
    required: true,
    example: 'JohnDoe',
    description: 'Username of the user',
  })
  @IsString()
  @IsNotEmpty()
  @NoSpaces({ message: 'Username cannot contain spaces' })
  @Transform(({ value }) => String(value).toLowerCase().trim())
  username: string;

  @ApiProperty({
    type: String,
    required: true,
    example: '12345678',
    description: 'User password',
  })
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword(PASSWORD_CONSTRAINT, {
    message: 'Password must be at least 8 characters and include an uppercase letter, a number, and a symbol.',
  })
  password: string;

  @ApiProperty({
    type: String,
    required: true,
    example: '12345678',
    description: 'Confirm user password',
  })
  @IsString()
  @Match('password', { message: 'Confirm password did not match' })
  @IsOptional()
  confirm_password?: string;

  @ApiProperty({
    type: String,
    required: true,
    example: 'John',
    description: 'User first name',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  first_name?: string;

  @ApiProperty({
    type: String,
    required: true,
    example: 'Doe',
    description: 'User last name',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  last_name?: string;

  @ApiProperty({
    type: String,
    required: false,
    example: 'Anthony',
    description: 'User middle name',
  })
  @IsString()
  @IsOptional()
  middle_name?: string;

  @ApiProperty({
    type: String,
    required: false,
    example: '123456789',
    description: 'User phone number (between 9 and 12 digits)',
  })
  @IsString({
    message: 'Phone number must be a string',
  })
  @IsOptional()
  phone_number?: string;

  @ApiProperty({
    type: String,
    required: false,
    example: 'NG',
    description: 'country code for phone number',
  })
  @IsString()
  @IsISO31661Alpha2()
  @IsOptional()
  phone_number_country_code?: string;

  @ApiProperty({
    type: String,
    required: true,
    example: 'usa',
    description: 'User country ID (FK to countries table)',
  })
  @IsString()
  @IsNotEmpty()
  country_id: string;

  @ApiProperty({
    type: String,
    required: false,
    example: '123456789',
    description: 'Verification token',
  })
  @IsString()
  @IsNotEmpty()
  @IsString()
  verification_token: string;
}
