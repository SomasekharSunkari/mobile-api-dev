import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Password reset code sent' })
  message: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: '2025-05-06T03:12:09.830Z' })
  timestamp: string;
}
