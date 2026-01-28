import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({
    description: 'Textual evidence for the dispute',
    required: false,
    maxLength: 65535,
  })
  @IsOptional()
  @IsString()
  @MaxLength(65535, { message: 'Text evidence must not exceed 65535 characters' })
  textEvidence?: string;
}
