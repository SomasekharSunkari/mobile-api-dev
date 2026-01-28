import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReactivateAccountDto {
  @ApiProperty({
    description: 'User ID of the account to reactivate',
    example: 'uuid-user-123',
  })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({
    description: 'Description/reason for account reactivation',
    example: 'User requested to reactivate their account',
  })
  @IsString()
  @IsNotEmpty()
  reactivation_description: string;
}

export class ReactivateAccountResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Account reactivated successfully' })
  message: string;

  @ApiProperty({ example: 'uuid-abc-123' })
  id: string;

  @ApiProperty({ example: 'activated' })
  status: string;

  @ApiProperty({ example: 'User requested to reactivate their account' })
  reactivation_description: string;

  @ApiProperty({ example: 'https://s3.amazonaws.com/bucket/support-doc.pdf' })
  reactivation_support_document_url: string;

  @ApiProperty({ example: '2025-05-05T15:30:00.000Z' })
  reactivated_on: string;
}
