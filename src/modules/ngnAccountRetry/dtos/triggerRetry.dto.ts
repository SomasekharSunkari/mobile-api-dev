import { ApiPropertyOptional } from '@nestjs/swagger';

export class TriggerNgnAccountRetryResponseDto {
  @ApiPropertyOptional({
    description: 'Status message about the scan job',
    example: 'Scan job queued. Users will be processed in chunks of 500.',
  })
  message: string;
}
