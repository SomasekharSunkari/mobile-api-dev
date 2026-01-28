import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateBlockchainBeneficiaryDto {
  @ApiProperty({ description: 'User ID of the beneficiary', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  beneficiary_user_id: string;

  @ApiProperty({ description: 'Alias name of the beneficiary', example: 'John Doe' })
  @IsOptional()
  @IsString()
  alias_name?: string;

  @ApiProperty({ description: 'Currency/asset of the beneficiary blockchain address', example: 'USDC' })
  @IsOptional()
  @IsString()
  asset?: string;

  @ApiProperty({
    description: 'Blockchain address of the beneficiary',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: 'Network of the beneficiary address', example: 'ethereum' })
  @IsOptional()
  @IsString()
  network?: string;
}
