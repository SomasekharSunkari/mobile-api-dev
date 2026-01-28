import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNotEmpty, IsNumber, IsPositive, IsOptional } from 'class-validator';

export enum TransferType {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

export class TransferDto {
  @ApiProperty({ description: 'External account ID from our system', example: 'ea7f8c9d-e1fd-41b6-ae8d-90e4403f3303' })
  @IsString()
  @IsNotEmpty()
  external_account_id: string;

  @ApiProperty({ description: 'Currency code (e.g., USD)', example: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({ description: 'Amount to transfer', example: 100 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Description for the transaction', example: 'COMPANY0', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Transfer type', enum: TransferType, example: TransferType.DEBIT })
  @IsEnum(TransferType)
  transfer_type: TransferType;
}
