import { ApiProperty } from '@nestjs/swagger';

export class GetProfileImageResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Profile image fetched successfully' })
  message: string;

  @ApiProperty({
    example: {
      avatar_url: 'https://s3.amazonaws.com/bucket/profile-images/user-id/image.jpg?signature=...',
    },
  })
  data: {
    avatar_url: string | null;
  };

  @ApiProperty({ example: '2025-05-07T15:51:52.002Z' })
  timestamp: string;
}
