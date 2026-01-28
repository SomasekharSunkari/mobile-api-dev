import { Module } from '@nestjs/common';
import { FireblocksAdapter } from './fireblocks/fireblocks_adapter';
import { BlockchainWaasAdapter } from './blockchain-waas-adapter';

@Module({
  providers: [BlockchainWaasAdapter, FireblocksAdapter],
  exports: [BlockchainWaasAdapter],
})
export class BlockChainWaasModule {}
