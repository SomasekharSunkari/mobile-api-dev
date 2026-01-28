import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateUsdFiatRewardsEnabledDto {
  @ApiProperty({
    type: Boolean,
    required: true,
    example: true,
    description: 'Whether the user wants to opt-in to USD fiat rewards',
  })
  @IsBoolean()
  @IsNotEmpty()
  enabled: boolean;
}
