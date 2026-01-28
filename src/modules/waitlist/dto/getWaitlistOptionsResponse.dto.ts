import { ApiProperty } from '@nestjs/swagger';
import {
  IWaitlistFeature,
  IWaitlistReason,
  WaitlistFeature,
  WaitlistReason,
} from '../../../database/models/waitlist/waitlist.interface';

export class GetWaitlistOptionsResponseDto {
  @ApiProperty({
    description: 'Supported waitlist reasons',
    enum: WaitlistReason,
    isArray: true,
  })
  reasons: IWaitlistReason[];

  @ApiProperty({
    description: 'Supported waitlist features',
    enum: WaitlistFeature,
    isArray: true,
  })
  features: IWaitlistFeature[];
}
