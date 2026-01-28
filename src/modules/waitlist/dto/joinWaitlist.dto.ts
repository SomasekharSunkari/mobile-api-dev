import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { IWaitlistFeature, IWaitlistReason, WaitlistFeature, WaitlistReason } from '../../../database/models/waitlist';

export class JoinWaitlistDto {
  @ApiProperty({
    description: 'The reason for joining the waitlist',
    enum: WaitlistReason,
    example: WaitlistReason.PHYSICAL_CARDS,
  })
  @IsNotEmpty()
  @IsEnum(WaitlistReason)
  reason: IWaitlistReason;

  @ApiProperty({
    description: 'The feature the user is joining the waitlist for',
    enum: WaitlistFeature,
    example: WaitlistFeature.CARD,
  })
  @IsNotEmpty()
  @IsEnum(WaitlistFeature)
  feature: IWaitlistFeature;
}
