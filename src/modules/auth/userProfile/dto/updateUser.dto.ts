import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ description: 'Gender of the user', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === null ? undefined : value))
  gender?: string;

  @ApiProperty({ description: 'Address line 1 of the user', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === null ? undefined : value))
  address_line1?: string;

  @ApiProperty({ description: 'Address line 2 of the user', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === null ? undefined : value))
  address_line2?: string;

  @ApiProperty({ description: 'City of the user', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === null ? undefined : value))
  city?: string;

  @ApiProperty({ description: 'State or province of the user', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === null ? undefined : value))
  state_or_province?: string;

  @ApiProperty({ description: 'Postal code of the user', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === null ? undefined : value))
  postal_code?: string;

  @ApiProperty({ description: 'Country ID of the user', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === null ? undefined : value))
  country_id?: string;

  @ApiProperty({ description: 'Date of birth of the user', required: false, type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dob?: Date;

  @ApiProperty({ description: 'Push notification token for the user device', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === null ? undefined : value))
  notification_token?: string;

  @ApiProperty({ description: 'S3 key of the profile image', required: false })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === null ? undefined : value))
  image_key?: string;
}
