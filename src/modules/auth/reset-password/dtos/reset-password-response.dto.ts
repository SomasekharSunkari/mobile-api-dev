import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Successfully Reset password' })
  message: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: '2025-05-06T03:15:46.326Z' })
  timestamp: string;
}
