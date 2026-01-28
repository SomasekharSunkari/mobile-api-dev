import { ApiProperty } from '@nestjs/swagger';

export class VerifyResetPinCodeResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Transaction PIN set successfully' })
  message: string;

  @ApiProperty({
    example: {
      pinSet: true,
    },
  })
  data: {
    verificationToken: string;
  };

  @ApiProperty({
    example: '2025-05-20T12:00:00.000Z',
    description: 'ISO timestamp of the response',
  })
  timestamp: string;
}
