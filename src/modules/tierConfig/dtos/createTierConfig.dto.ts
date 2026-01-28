import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { TierStatus } from '../../../database/models/tier';
import { ExistsIn } from '../../../decorators/ExistsIn';
import { IsGreaterThan } from '../../../decorators/IsGreaterThan';
import { CountryRepository } from '../../country';
import { TierRepository } from '../../tier/tier.repository';

export class CreateTierConfigDto {
  @ApiProperty()
  @IsString()
  @ExistsIn(new TierRepository(), 'id')
  tier_id: string;

  @ApiProperty()
  @IsString()
  @ExistsIn(new CountryRepository(), 'id')
  country_id: string;

  @ApiProperty({ enum: TierStatus })
  @IsEnum(TierStatus)
  status: TierStatus;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNumber()
  level: number;

  @ApiProperty()
  @IsNumber()
  minimum_deposit: number;

  @ApiProperty()
  @IsNumber()
  @IsGreaterThan((value, object) => value > object.minimum_deposit, {
    message: 'Maximum Deposit is suppose to be lesser than minimum deposit',
  })
  maximum_single_deposit: number;

  @ApiProperty()
  @IsNumber()
  minimum_balance: number;

  @ApiProperty()
  @IsNumber()
  @IsGreaterThan((value, object) => value > object.minimum_balance, {
    message: 'Maximum Balance is suppose to be lesser than minimum balance',
  })
  maximum_balance: number;

  @ApiProperty()
  @IsNumber()
  maximum_daily_deposit: number;

  @ApiProperty()
  @IsNumber()
  maximum_monthly_deposit: number;

  @ApiProperty()
  @IsNumber()
  minimum_transaction_amount: number;

  @ApiProperty()
  @IsNumber()
  maximum_transaction_amount: number;

  @ApiProperty()
  @IsNumber()
  maximum_daily_transaction: number;

  @ApiProperty()
  @IsNumber()
  maximum_monthly_transaction: number;

  // remittance

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  remittance_minimum_per_deposit?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  remittance_maximum_per_deposit?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  remittance_maximum_daily_deposit?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  remittance_maximum_monthly_deposit?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  remittance_minimum_transaction_amount?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  remittance_maximum_transaction_amount?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  remittance_maximum_daily_transaction?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  remittance_maximum_monthly_transaction?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  total_spendable?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  total_receivable?: number;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  update_remittance_automatically?: boolean;
}
