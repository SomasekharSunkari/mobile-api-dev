import { forwardRef, Module } from '@nestjs/common';
import { LockerModule } from '../../services/locker';
import { PushNotificationModule } from '../../services/pushNotification/pushNotification.module';
import { UsdFiatRewardsModule } from '../../services/queue/processors/usd-fiat-rewards/usd-fiat-rewards.module';
import { UserProfileModule } from '../auth/userProfile/userProfile.module';
import { InAppNotificationModule } from '../inAppNotification';
import { DoshPointsController } from './doshPoints.controller';
import { DoshPointsAccountRepository, DoshPointsAccountService } from './doshPointsAccount';
import { DoshPointsEventRepository, DoshPointsEventService } from './doshPointsEvent';
import { DoshPointsStablecoinRewardService } from './doshPointsStablecoinReward/doshPointsStablecoinReward.service';
import { DoshPointsTransactionRepository, DoshPointsTransactionService } from './doshPointsTransaction';

@Module({
  imports: [
    LockerModule,
    InAppNotificationModule,
    forwardRef(() => UsdFiatRewardsModule),
    PushNotificationModule,
    UserProfileModule,
  ],
  controllers: [DoshPointsController],
  providers: [
    DoshPointsAccountService,
    DoshPointsAccountRepository,
    DoshPointsTransactionService,
    DoshPointsTransactionRepository,
    DoshPointsEventService,
    DoshPointsEventRepository,
    DoshPointsStablecoinRewardService,
  ],
  exports: [
    DoshPointsAccountService,
    DoshPointsAccountRepository,
    DoshPointsTransactionService,
    DoshPointsTransactionRepository,
    DoshPointsEventService,
    DoshPointsEventRepository,
    DoshPointsStablecoinRewardService,
  ],
})
export class DoshPointsModule {}
