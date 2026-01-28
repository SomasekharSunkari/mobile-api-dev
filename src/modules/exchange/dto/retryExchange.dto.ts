import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RetryExchangeDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  @ApiProperty({
    description: 'The parent USD transaction ID to retry',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  parent_transaction_id: string;
}

export class RetryExchangeResponseDto {
  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiProperty({ description: 'The parent transaction ID that was retried' })
  parent_transaction_id: string;

  @ApiProperty({ description: 'The new virtual account number created' })
  new_account_number: string;

  @ApiProperty({ description: 'The new YellowCard sequence reference' })
  new_sequence_ref: string;
}
