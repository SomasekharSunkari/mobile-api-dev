import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class CreateContactSupportDto {
  @ApiProperty({ description: 'Support ticket subject', example: 'General Inquiry' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ description: 'Support ticket description', example: 'Need help with onboarding' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Support ticket content/details',
    example: 'I would like to know more about your services...',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'User email address (required for contact)',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  user_email: string;

  @ApiProperty({
    description: 'Resource ID related to the ticket',
    example: 'card_123456',
    required: false,
  })
  @IsString()
  @IsOptional()
  resource_id?: string;
}
