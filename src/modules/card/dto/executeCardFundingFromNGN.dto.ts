import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ExecuteCardFundingFromNGNDto {
  @ApiProperty({
    description: 'Transaction reference from initialization step',
    example: 'TXN-REF-789',
  })
  @IsNotEmpty()
  @IsString()
  transaction_id: string;

  @ApiProperty({
    description: 'Transaction PIN for authorization',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  transaction_pin: string;
}
