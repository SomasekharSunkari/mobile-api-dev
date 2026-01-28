import { ApiProperty } from '@nestjs/swagger';

export class VerifyCodeResponse {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Account Verified Successfully' })
  message: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: '2025-05-06T02:56:07.136Z' })
  timestamp: string;
}
