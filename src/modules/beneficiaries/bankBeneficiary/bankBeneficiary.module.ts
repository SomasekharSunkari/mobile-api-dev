import { Module } from '@nestjs/common';
import { BankBeneficiaryController } from './bankBeneficiary.controller';
import { BankBeneficiaryRepository } from './bankBeneficiary.repository';
import { BankBeneficiaryService } from './bankBeneficiary.service';

@Module({
  controllers: [BankBeneficiaryController],
  providers: [BankBeneficiaryRepository, BankBeneficiaryService],
  exports: [BankBeneficiaryRepository, BankBeneficiaryService],
})
export class BankBeneficiaryModule {}
