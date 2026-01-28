import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum SumSubVerificationType {
  TIER_ONE_VERIFICATION = 'tier-one-verification',
  TIER_TWO_VERIFICATION = 'tier-two-verification',
  TIER_THREE_VERIFICATION = 'tier-three-verification',
  VERIFY_YOUR_IDENTITY = 'verify-your-identity',
  ID_AND_LIVENESS = 'id-and-liveness',
  ID_ONLY = 'id-only',
  ID_AND_PHONE_VERIFICATION = 'id-and-phone-verification',
  ENHANCED_KYC = 'enhanced-kyc',
  APPLICANT_INFO = 'applicant-info',
  LIVENESS_ONLY = 'liveness-only',
}

export const sumsubTierOneWorkFlow: SumSubVerificationType[] = [
  SumSubVerificationType.TIER_ONE_VERIFICATION,
  SumSubVerificationType.APPLICANT_INFO,
  SumSubVerificationType.ID_ONLY,
  SumSubVerificationType.LIVENESS_ONLY,
];

export class InitiateWidgetKycDto {
  @ApiProperty({
    enum: SumSubVerificationType,
    description: 'The type of verification to perform',
  })
  @IsEnum(SumSubVerificationType)
  verification_type: SumSubVerificationType;
}
