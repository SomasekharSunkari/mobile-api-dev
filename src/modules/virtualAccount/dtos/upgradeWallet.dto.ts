import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { VirtualAccountTier } from '../../../database/models/virtualAccount/virtualAccount.interface';

export class UpgradeWalletFilesDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
  })
  user_photo: Express.Multer.File[];

  @ApiProperty({
    type: 'string',
    format: 'binary',
  })
  id_card_front: Express.Multer.File[];

  @ApiProperty({
    type: 'string',
    format: 'binary',
  })
  utility_bill: Express.Multer.File[];

  @ApiProperty({
    type: 'string',
    format: 'binary',
  })
  proof_of_address_verification: Express.Multer.File[];
}

export class UpgradeWalletDto extends UpgradeWalletFilesDto {
  @ApiProperty()
  @IsString()
  account_number: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  nin: string;

  @ApiProperty({
    enum: VirtualAccountTier,
    description: 'The tier to upgrade to',
  })
  @IsEnum(VirtualAccountTier)
  tier: VirtualAccountTier;

  @ApiProperty({
    description: 'ID number for verification',
    example: '22316109918',
  })
  @IsString()
  id_number: string;

  @ApiProperty({
    description: 'Street name',
    example: 'Elegushi',
  })
  @IsString()
  street_name: string;

  @ApiProperty({
    description: 'State',
    example: 'Lagos',
  })
  @IsString()
  state: string;

  @ApiProperty({
    description: 'City',
    example: 'Lekki',
  })
  @IsString()
  city: string;

  @ApiProperty({
    description: 'Local government area',
    example: 'Eti-osa',
  })
  @IsString()
  local_government: string;

  @ApiProperty({
    description: 'Politically exposed person status',
    example: 'NO',
  })
  @IsString()
  pep: string;
}
