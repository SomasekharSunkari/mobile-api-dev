import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class FreezeCardDto {
  @ApiProperty({
    description: 'Whether to freeze (true) or unfreeze (false) the card',
    example: true,
  })
  @IsBoolean()
  freeze: boolean;

  @ApiProperty({
    description: 'Transaction PIN for authorization',
    example: '123456',
    required: true,
  })
  @IsNotEmpty({ message: 'Transaction PIN is required' })
  @IsString()
  transaction_pin: string;
}
