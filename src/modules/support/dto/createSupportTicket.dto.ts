import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class CreateSupportTicketDto {
  @ApiProperty({ description: 'Support ticket subject', example: 'Login Issue' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ description: 'Support ticket description', example: 'Unable to login to my account' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Support ticket content/details',
    example: 'I am getting an error when trying to login...',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'User email address (optional - will use logged-in user email if not provided)',
    example: 'user@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  user_email?: string;

  @ApiProperty({
    description: 'Resource ID related to the ticket',
    example: 'card_123456',
    required: false,
  })
  @IsString()
  @IsOptional()
  resource_id?: string;
}
