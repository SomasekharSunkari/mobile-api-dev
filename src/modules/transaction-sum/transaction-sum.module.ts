import { Module } from '@nestjs/common';
import { TransactionSumRepository } from './transaction-sum.repository';
import { TransactionSumService } from './transaction-sum.service';

@Module({
  providers: [TransactionSumService, TransactionSumRepository],
  exports: [TransactionSumService],
})
export class TransactionSumModule {}
