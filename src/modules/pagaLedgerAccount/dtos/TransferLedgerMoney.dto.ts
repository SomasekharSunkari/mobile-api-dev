import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class TransferLedgerMoneyDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'The source account number' })
  sourceAccountNumber: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'The destination account number' })
  destinationAccountNumber: string;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({ description: 'The amount to transfer' })
  amount: number;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'The transaction reference' })
  transactionReference: string;

  @IsNotEmpty()
  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'The description' })
  description?: string;
}
