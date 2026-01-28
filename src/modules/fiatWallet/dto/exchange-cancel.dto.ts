import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeCancelDto {
  @ApiProperty({
    description: 'Transaction ID to cancel exchange for',
    example: 'txn_123456789',
  })
  @IsNotEmpty()
  @IsString()
  transaction_id: string;
}
