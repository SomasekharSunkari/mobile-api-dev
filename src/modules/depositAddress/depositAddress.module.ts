import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ParticipantAdapterModule } from '../../adapters/participant/participant.adapter.module';
import { ExternalAccountModule } from '../externalAccount/external-account.module';
import { DepositAddressController } from './depositAddress.controller';
import { DepositAddressService } from './depositAddress.service';
import { DepositAddressRepository } from './depositAddress.repository';

@Module({
  imports: [DatabaseModule, ParticipantAdapterModule, ExternalAccountModule],
  controllers: [DepositAddressController],
  providers: [DepositAddressService, DepositAddressRepository],
  exports: [DepositAddressService, DepositAddressRepository],
})
export class DepositAddressModule {}
