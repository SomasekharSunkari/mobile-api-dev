import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TransferFiatWalletDto {
  @ApiProperty({
    description: 'Username of the recipient',
    example: 'john_doe',
  })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({
    description: 'Amount to transfer',
    example: 100.5,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Asset/Currency to transfer',
    enum: ['USD', 'NGN'],
    example: 'USD',
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(['USD', 'NGN'])
  asset: string;

  @ApiProperty({
    description: 'Remark for the transfer',
    example: 'Transfer to John Doe',
  })
  @IsOptional()
  @IsString()
  remark?: string;
}
