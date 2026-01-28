import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTierConfigDto } from './createTierConfig.dto';

export class UpdateTierConfigDto extends PartialType(OmitType(CreateTierConfigDto, ['tier_id', 'level'])) {}
