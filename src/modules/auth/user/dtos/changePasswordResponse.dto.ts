import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Password changed successfully' })
  message: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Password changed successfully' })
  internalMessage: string;

  @ApiProperty({ example: '2025-05-05T21:08:38.356Z' })
  timestamp: string;
}
