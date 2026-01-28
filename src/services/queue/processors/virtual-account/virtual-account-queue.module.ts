import { Module } from '@nestjs/common';
import { WaasModule } from '../../../../adapters/waas/waas.adapter.module';
import { UserTierModule } from '../../../../modules/userTier';
import { VirtualAccountModule } from '../../../../modules/virtualAccount';
import { QueueModule } from '../../queue.module';
import { VirtualAccountProcessor } from './virtual-account.processor';

@Module({
  imports: [QueueModule, VirtualAccountModule, UserTierModule, WaasModule],
  providers: [VirtualAccountProcessor],
  exports: [VirtualAccountProcessor],
})
export class VirtualAccountQueueModule {}
