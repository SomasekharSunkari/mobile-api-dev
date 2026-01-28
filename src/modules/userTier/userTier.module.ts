import { forwardRef, Global, Module } from '@nestjs/common';
import { LockerModule } from '../../services/locker/locker.module';
import { CountryModule } from '../country/country.module';
import { FiatWalletTransactionRepository } from '../fiatWalletTransactions/fiatWalletTransactions.repository';
import { TierModule } from '../tier/tier.module';
import { TierConfigModule } from '../tierConfig/tierConfig.module';
import { TransactionAggregateModule } from '../transactionAggregate/transactionAggregate.module';
import { TransactionSumModule } from '../transaction-sum/transaction-sum.module';
import { UserTierController } from './userTier.controller';
import { UserTierRepository } from './userTier.repository';
import { UserTierService } from './userTier.service';

@Global()
@Module({
  controllers: [UserTierController],
  providers: [UserTierRepository, UserTierService, FiatWalletTransactionRepository],
  imports: [
    forwardRef(() => TierModule),
    TierConfigModule,
    CountryModule,
    TransactionSumModule,
    TransactionAggregateModule,
    LockerModule,
  ],
  exports: [UserTierService, UserTierRepository],
})
export class UserTierModule {}
