import { Module } from '@nestjs/common';
import { BlockChainWalletModule } from '../../blockchainWallet/blockchainWallet.module';
import { TransactionModule } from '../../transaction';
import { FireblocksWebhookController } from './fireblocks-webhook.controller';
import { FireblocksWebhookService } from './fireblocks-webhook.service';

@Module({
  imports: [BlockChainWalletModule, TransactionModule],
  controllers: [FireblocksWebhookController],
  providers: [FireblocksWebhookService],
  exports: [FireblocksWebhookService],
})
export class FireblocksWebhookModule {}
