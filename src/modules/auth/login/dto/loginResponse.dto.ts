import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: 'Login successful' })
  message: string;

  @ApiProperty({
    example: {
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      expiration: '2025-05-05T23:11:27.739Z',
    },
  })
  credentials: {
    access_token: string;
    expiration: string;
  };

  @ApiProperty({
    example: {
      id: 'why4m3zmwxlsedxkzraw7zg',
      email: 'kyle.harmon@onedosh.com',
      username: 'kharmon',
      phone_number: null,
      account_verified: false,
      isBlacklistedRegion: false,
    },
  })
  user: {
    id: string;
    email: string;
    username: string;
    phone_number: string | null;
    account_verified: boolean;
    isBlacklistedRegion?: boolean;
  };

  @ApiProperty({
    example: '2025-05-05T23:11:27.794Z',
    description: 'ISO timestamp of the response',
  })
  timestamp: string;
}
