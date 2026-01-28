import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ExistsIn } from '../../../decorators/ExistsIn';
import { TierRepository } from '../../tier/tier.repository';

export class CreateUserTierDto {
  @ApiProperty()
  @IsString()
  @ExistsIn(new TierRepository(), 'id')
  tier_id: string;
}
