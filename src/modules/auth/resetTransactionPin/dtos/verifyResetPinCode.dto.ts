import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyResetPinCodeDto {
  @ApiProperty({ description: 'Reset PIN code sent to user email' })
  @IsNotEmpty()
  @IsString()
  code: string;
}
