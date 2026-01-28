import { Module } from '@nestjs/common';
import { MailerModule } from '../../../services/queue/processors/mailer/mailer.module';
import { S3Module } from '../../../services/s3';
import { InAppNotificationModule } from '../../inAppNotification/inAppNotification.module';
import { AccessTokenModule } from '../accessToken';
import { AccountActionCodeModule } from '../accountActionCode/accountActionCode.module';
import { RefreshTokenModule } from '../refreshToken';
import { UserModule } from '../user/user.module';
import { AccountDeactivationController } from './accountDeactivation.controller';
import { AccountDeactivationRepository } from './accountDeactivation.repository';
import { AccountDeactivationService } from './accountDeactivation.service';

@Module({
  providers: [AccountDeactivationService, AccountDeactivationRepository],
  exports: [AccountDeactivationService, AccountDeactivationRepository],
  imports: [
    UserModule,
    AccountActionCodeModule,
    RefreshTokenModule,
    AccessTokenModule,
    MailerModule,
    S3Module,
    InAppNotificationModule,
  ],
  controllers: [AccountDeactivationController],
})
export class AccountDeactivationModule {}
