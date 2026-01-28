import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSystemUsersBeneficiaryDto {
  @ApiProperty({
    description: 'ID of the beneficiary user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsString()
  beneficiary_user_id: string;

  @ApiProperty({
    description: 'Alias name for the beneficiary',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  alias_name?: string;
}
