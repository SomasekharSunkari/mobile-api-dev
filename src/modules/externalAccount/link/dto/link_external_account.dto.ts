import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class PlaidInstitutionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  id?: string;
}

export class PlaidAccountDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  mask: string;

  @IsString()
  type: string;

  @IsString()
  subtype: string;

  @IsOptional()
  @IsString()
  verification_status?: string;

  @IsOptional()
  @IsString()
  class_type?: string;
}

export class PlaidMetadataDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  link_session_id?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlaidInstitutionDto)
  institution?: PlaidInstitutionDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaidAccountDto)
  accounts?: PlaidAccountDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PlaidAccountDto)
  account?: PlaidAccountDto;

  @IsOptional()
  @IsString()
  account_id?: string;

  @IsOptional()
  @IsString()
  transfer_status?: string;

  @IsOptional()
  wallet?: any;

  @IsOptional()
  @IsString()
  public_token?: string;
}

export class PlaidLinkTokenExchangeDto {
  @IsString()
  public_token: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlaidMetadataDto)
  metadata?: PlaidMetadataDto;
}
