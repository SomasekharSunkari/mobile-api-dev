import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OnRampNGToUSDDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @ApiProperty({
    description: 'The amount of NG to convert to USD',
    example: 1000.5,
  })
  amount: number;

  @ApiProperty({
    description: 'The username of the user',
    example: 'john_doe',
  })
  receiver_username: string;

  @ApiProperty({
    description: 'The system user beneficiary id',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  system_user_beneficiary_id?: string;
}
