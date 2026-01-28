import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { IWaitlistFeature, IWaitlistReason, WaitlistFeature, WaitlistReason } from '../../../database/models/waitlist';

export class GetUserWaitlistsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter waitlists by reason for joining',
    enum: WaitlistReason,
    example: WaitlistReason.PHYSICAL_CARDS,
    required: false,
  })
  @IsOptional()
  @IsEnum(WaitlistReason)
  reason?: IWaitlistReason;

  @ApiPropertyOptional({
    description: 'Filter waitlists by feature',
    enum: WaitlistFeature,
    example: WaitlistFeature.CARD,
    required: false,
  })
  @IsOptional()
  @IsEnum(WaitlistFeature)
  feature?: IWaitlistFeature;
}
