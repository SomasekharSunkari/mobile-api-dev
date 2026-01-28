import { Module } from '@nestjs/common';
import { BankBeneficiaryModule } from './bankBeneficiary';
import { BlockchainBeneficiaryModule } from './blockchainBeneficiary';
import { SystemUsersBeneficiaryModule } from './systemUsersBeneficiary';

@Module({
  imports: [SystemUsersBeneficiaryModule, BankBeneficiaryModule, BlockchainBeneficiaryModule],
  controllers: [],
  providers: [],
})
export class BeneficiaryModule {}
