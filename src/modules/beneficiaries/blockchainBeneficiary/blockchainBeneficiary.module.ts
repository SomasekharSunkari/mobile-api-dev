import { Module } from '@nestjs/common';
import { UserModule } from '../../auth/user/user.module';
import { BlockchainBeneficiaryController } from './blockchainBeneficiary.controller';
import { BlockchainBeneficiaryRepository } from './blockchainBeneficiary.repository';
import { BlockchainBeneficiaryService } from './blockchainBeneficiary.service';

@Module({
  controllers: [BlockchainBeneficiaryController],
  providers: [BlockchainBeneficiaryRepository, BlockchainBeneficiaryService],
  exports: [BlockchainBeneficiaryRepository, BlockchainBeneficiaryService],
  imports: [UserModule],
})
export class BlockchainBeneficiaryModule {}
