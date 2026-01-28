import { Module } from '@nestjs/common';
import { WaasModule } from '../../adapters/waas/waas.adapter.module';
import { CountryModule } from '../country';
import { BankController } from './bank.controller';
import { BankRepository } from './bank.repository';
import { BankService } from './bank.service';

@Module({
  providers: [BankRepository, BankService],
  exports: [BankService, BankRepository],
  imports: [WaasModule, CountryModule],
  controllers: [BankController],
})
export class BankModule {}
