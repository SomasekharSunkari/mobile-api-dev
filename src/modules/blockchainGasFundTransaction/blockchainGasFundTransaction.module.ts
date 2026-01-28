import { Module } from '@nestjs/common';
import { BlockchainGasFundTransactionService } from './blockchainGasFundTransaction.service';
import { BlockchainGasFundTransactionRepository } from './blockchainGasFundTransaction.repository';

@Module({
  providers: [BlockchainGasFundTransactionService, BlockchainGasFundTransactionRepository],
  exports: [BlockchainGasFundTransactionService, BlockchainGasFundTransactionRepository],
})
export class BlockchainGasFundTransactionModule {}
