import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class AdminBlockUnlockCardDto {
  @ApiProperty({
    description: 'Whether to block (true) or unlock (false) the card',
    example: true,
  })
  @IsBoolean()
  block: boolean;
}
