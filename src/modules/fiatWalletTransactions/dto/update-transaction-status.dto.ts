import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { TransactionStatus } from '../../../database/models/transaction';

export class UpdateTransactionStatusDto {
  @ApiProperty({
    description: 'The status to update the transaction to',
    enum: TransactionStatus,
    example: TransactionStatus.COMPLETED,
  })
  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @ApiProperty({
    description: 'Provider reference ID',
    example: 'pay_123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  provider_reference?: string;

  @ApiProperty({
    description: 'Provider metadata',
    example: { receipt_url: 'https://example.com/receipt/123' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  provider_metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Reason for failure if status is FAILED',
    example: 'Insufficient funds',
    required: false,
  })
  @IsOptional()
  @IsString()
  failure_reason?: string;
}
