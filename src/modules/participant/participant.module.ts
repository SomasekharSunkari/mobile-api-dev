import { Module } from '@nestjs/common';
import { ParticipantAdapterModule } from '../../adapters/participant/participant.adapter.module';
import { KYCAdapterModule } from '../../adapters/kyc/kyc-adapter.module';
import { ExternalAccountModule } from '../externalAccount/external-account.module';
import { DepositAddressModule } from '../depositAddress/depositAddress.module';
import { ParticipantService } from './participant.service';

@Module({
  imports: [ParticipantAdapterModule, KYCAdapterModule, ExternalAccountModule, DepositAddressModule],
  providers: [ParticipantService],
  exports: [ParticipantService],
})
export class ParticipantModule {}
