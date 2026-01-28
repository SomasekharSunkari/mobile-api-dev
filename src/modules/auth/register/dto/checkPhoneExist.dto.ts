import { ApiProperty } from '@nestjs/swagger';
import { IsISO31661Alpha2, IsNotEmpty, IsString } from 'class-validator';

export class CheckPhoneExistDto {
  @ApiProperty({
    type: String,
    required: false,
    example: '123456789',
    description: 'User phone number (between 9 and 12 digits)',
  })
  @IsString({
    message: 'Phone number must be a string',
  })
  @IsNotEmpty({
    message: 'Phone number is required',
  })
  phone_number: string;

  @ApiProperty({
    type: String,
    required: false,
    example: 'NG',
    description: 'country code for phone number',
  })
  @IsString()
  @IsISO31661Alpha2()
  phone_number_country_code?: string;
}
