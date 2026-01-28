import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SumSubVerificationType } from './generateSumsubAccessToken.dto';

export class RestartKycVerificationDto {
  @ApiProperty({
    enum: SumSubVerificationType,
    description: 'The type of verification to restart',
  })
  @IsEnum(SumSubVerificationType)
  verification_type: SumSubVerificationType;
}
