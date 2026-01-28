import { Module } from '@nestjs/common';
import { BlockchainWalletService } from './blockchainWallet.service';
import { BlockChainWaasModule } from '../../adapters/blockchain-waas/blockchain-waas-adapter.module';
import { BlockchainWalletController } from './blockchainWallet.controller';
import { BlockchainWalletRepository } from './blockchainWallet.repository';
import { LockerModule } from '../../services/locker/locker.module';
import { StreamModule } from '../../services/streams/stream.module';
import { BlockchainWalletTransactionRepository } from '../blockchainWalletTransaction/blockchainWalletTransaction.repository';
import { TransactionModule } from '../transaction/transaction.module';
import { BlockchainWalletTransactionModule } from '../blockchainWalletTransaction/blockchainWalletTransaction.module';
import { UserModule } from '../auth/user/user.module';
import { BlockchainAccountsModule } from '../blockchainAccounts/blockchainAccounts.module';
import { DepositAddressModule } from '../depositAddress/depositAddress.module';
import { BlockchainGasFundTransactionModule } from '../blockchainGasFundTransaction/blockchainGasFundTransaction.module';
import { InAppNotificationModule } from '../inAppNotification/inAppNotification.module';
import { BlockchainModule } from '../../services/blockchain/blockchain.module';
import { BlockchainWalletKeyRepository } from '../blockchainWalletKey/blockchainWalletKey.repository';

@Module({
  imports: [
    BlockchainWalletTransactionModule,
    BlockChainWaasModule,
    LockerModule,
    TransactionModule,
    UserModule,
    BlockchainAccountsModule,
    DepositAddressModule,
    BlockchainGasFundTransactionModule,
    StreamModule,
    InAppNotificationModule,
    BlockchainModule,
  ],
  providers: [
    BlockchainWalletService,
    BlockchainWalletRepository,
    BlockchainWalletTransactionRepository,
    BlockchainWalletKeyRepository,
  ],
  exports: [BlockchainWalletService, BlockchainWalletRepository, BlockchainWalletTransactionRepository],
  controllers: [BlockchainWalletController],
})
export class BlockChainWalletModule {}
