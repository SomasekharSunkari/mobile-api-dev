import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Match } from '../../../../decorators/Match';

export class ChangePinDto {
  @ApiProperty({ description: 'Old transaction PIN' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'Confirm PIN must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Confirm PIN must be numeric and 6 digits' })
  old_pin: string;

  @ApiProperty({ description: 'New transaction PIN' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'Confirm PIN must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Confirm PIN must be numeric and 6 digits' })
  pin: string;

  @ApiProperty({ description: 'Confirmation of new transaction PIN' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'Confirm PIN must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Confirm PIN must be numeric and 6 digits' })
  @Match('pin', { message: 'New PIN and confirm new PIN must match' })
  confirm_pin: string;
}
