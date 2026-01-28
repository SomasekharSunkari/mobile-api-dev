import { Module } from '@nestjs/common';
import { BlockchainAccountsRepository } from './blockchainAccounts.repository';
import { BlockchainAccountsService } from './blockchainAccounts.service';

@Module({
  providers: [BlockchainAccountsService, BlockchainAccountsRepository],
  exports: [BlockchainAccountsService, BlockchainAccountsRepository],
})
export class BlockchainAccountsModule {}
