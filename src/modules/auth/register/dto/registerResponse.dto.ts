import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: 'User registered successfully' })
  message: string;

  @ApiProperty({
    example: {
      access_token: '123',
      expiration: '2025-05-05T22:53:03.915Z',
    },
  })
  credentials: {
    access_token: string;
    expiration: string;
  };

  @ApiProperty({
    example: {
      account_verified: false,
      kyc_status: 'not_started',
      id: '123',
      email: 'user@onedosh.com',
      username: 'user',
      phone_number: null,
    },
  })
  user: {
    account_verified: boolean;
    kyc_status: string;
    id: string;
    email: string;
    username: string;
    phone_number: string | null;
  };

  @ApiProperty({
    example: '2025-05-05T21:53:03.979Z',
    description: 'ISO timestamp of the response',
  })
  timestamp: string;
}
