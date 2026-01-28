import { ApiProperty } from '@nestjs/swagger';

export class AccountVerificationResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Verification Code Sent Successfully' })
  message: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: '2025-05-06T02:46:28.348Z' })
  timestamp: string;
}
