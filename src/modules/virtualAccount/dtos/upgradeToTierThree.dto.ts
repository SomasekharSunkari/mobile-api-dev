import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpgradeFromTierTwoToTierThreeDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  proof_of_address_verification: Express.Multer.File;

  @ApiProperty()
  @IsString()
  @IsOptional()
  account_number: string;
}
