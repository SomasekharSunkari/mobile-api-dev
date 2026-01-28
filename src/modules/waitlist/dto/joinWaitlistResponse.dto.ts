import { ApiProperty } from '@nestjs/swagger';
import { WaitlistModel } from '../../../database/models/waitlist';

export class JoinWaitlistResponseDto {
  @ApiProperty({
    description: 'The waitlist entry',
    type: WaitlistModel,
  })
  waitlist: WaitlistModel;
}
