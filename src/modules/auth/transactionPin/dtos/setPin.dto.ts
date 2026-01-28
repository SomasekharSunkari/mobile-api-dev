import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Match } from '../../../../decorators/Match';

export class SetPinDto {
  @ApiProperty({
    description: 'PIN must be exactly 6 numeric digits',
    example: '123456',
    minLength: 6,
    maxLength: 6,
    pattern: '^\\d{6}$',
  })
  @IsString()
  @Length(6, 6, { message: 'PIN must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'PIN must be numeric and 6 digits' })
  pin: string;

  @ApiProperty({
    description: 'Confirm PIN must match PIN and be exactly 6 numeric digits',
    example: '123456',
    minLength: 6,
    maxLength: 6,
    pattern: '^\\d{6}$',
  })
  @IsString()
  @Length(6, 6, { message: 'Confirm PIN must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Confirm PIN must be numeric and 6 digits' })
  @Match('pin', { message: 'PIN and confirm PIN must match' })
  confirm_pin: string;
}
