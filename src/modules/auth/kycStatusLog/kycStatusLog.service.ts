import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { KycVerificationRepository } from '../kycVerification/kycVerification.repository';
import { KycStatusLogRepository } from './kycStatusLog.repository';

@Injectable()
export class KycStatusLogService {
  @Inject(KycStatusLogRepository)
  private readonly kycStatusLogRepository: KycStatusLogRepository;

  @Inject(KycVerificationRepository)
  private readonly kycRepository: KycVerificationRepository;

  async logStatusChange(
    kycId: string,
    oldStatus: string | null,
    newStatus: string,
    comment?: string,
    trx?: Knex.Transaction,
  ): Promise<void> {
    const kyc = await this.kycRepository.findById(kycId, undefined, trx);

    if (!kyc) {
      throw new NotFoundException(`KYC record not found for ID: ${kycId}`);
    }

    await this.kycStatusLogRepository.create(
      {
        kyc_id: kycId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_at: new Date().toISOString(),
        comment: comment ?? null,
      },
      trx,
    );
  }
}
