import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class ValidateTransactionPinDto {
  @ApiProperty({
    description: 'Transaction PIN must be exactly 6 numeric digits',
    example: '123456',
    minLength: 6,
    maxLength: 6,
    pattern: '^\\d{6}$',
  })
  @IsString()
  @Length(6, 6, { message: 'PIN must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'PIN must be numeric and 6 digits' })
  pin: string;
}
