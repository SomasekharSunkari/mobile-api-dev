import { Module } from '@nestjs/common';
import { BlockchainWalletTransactionRepository } from './blockchainWalletTransaction.repository';
import { BlockchainWalletTransactionService } from './blockchainWalletTransaction.service';
import { FireblocksAdapter } from '../../adapters/blockchain-waas/fireblocks/fireblocks_adapter';
import { TransactionModule } from '../transaction/transaction.module';
import { BlockchainWalletRepository } from '../blockchainWallet/blockchainWallet.repository';
import { InAppNotificationModule } from '../inAppNotification/inAppNotification.module';

@Module({
  imports: [TransactionModule, InAppNotificationModule],
  providers: [
    BlockchainWalletTransactionRepository,
    BlockchainWalletTransactionService,
    FireblocksAdapter,
    BlockchainWalletRepository,
  ],
  exports: [BlockchainWalletTransactionRepository, BlockchainWalletTransactionService],
})
export class BlockchainWalletTransactionModule {}
