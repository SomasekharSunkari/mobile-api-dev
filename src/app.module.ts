import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { CardAdapterModule } from './adapters/card/card.adapter.module';
import { ExchangeAdapterModule } from './adapters/exchange/exchange.adapter.module';
import { WaasModule } from './adapters/waas/waas.adapter.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/core/config.module';
import { DatabaseModule } from './database';
import { AccountDeleteRequestModule } from './modules/auth/accountDeleteRequest/accountDeleteRequest.module';
import { AccountVerificationModule } from './modules/auth/accountVerification/accountVerification.module';
import { AuthModule } from './modules/auth/auth.module';
import { TransactionPinGuardModule } from './modules/auth/guard/transactionPinGuard/transactionPin.guard.module';
import { IpCountryBanModule } from './modules/auth/ipCountryBan';
import { KycVerificationModule } from './modules/auth/kycVerification/kycVerification.module';
import { LoginModule } from './modules/auth/login/login.module';
import { RefreshTokenModule } from './modules/auth/refreshToken';
import { RegisterModule } from './modules/auth/register';
import { ResetPasswordModule } from './modules/auth/reset-password/reset-password.module';
import { ResetTransactionPinModule } from './modules/auth/resetTransactionPin/resetTransactionPin.module';
import { RoleModule } from './modules/auth/role/role.module';
import { TransactionPinModule } from './modules/auth/transactionPin/transactionPin.module';
import { UserModule } from './modules/auth/user/user.module';
import { UserRoleModule } from './modules/auth/userRole/user_role.module';
import { VerificationTokenModule } from './modules/auth/verificationToken';
import { BankModule } from './modules/bank';
import { BeneficiaryModule } from './modules/beneficiaries/beneficiary.module';
import { BlockChainWalletModule } from './modules/blockchainWallet/blockchainWallet.module';
import { CardModule } from './modules/card/card.module';
import { DepositAddressModule } from './modules/depositAddress/depositAddress.module';
import { DoshPointsModule } from './modules/doshPoints/doshPoints.module';
import { ExchangeModule } from './modules/exchange/exchange.module';
import { ExternalAccountModule } from './modules/externalAccount/external-account.module';
import { FeatureFlagModule } from './modules/featureFlag/featureFlag.module';
import { FeatureFlagOverrideModule } from './modules/featureFlagOverride/featureFlagOverride.module';
import { FiatWalletModule } from './modules/fiatWallet/fiatWallet.module';
import { FiatWalletTransactionModule } from './modules/fiatWalletTransactions/fiatWalletTransactions.module';
import { InAppNotificationModule } from './modules/inAppNotification';
import { PagaLedgerAccountModule } from './modules/pagaLedgerAccount/pagaLedgerAccount.module';
import { PagaLedgerTransactionModule } from './modules/pagaLedgerTransaction/pagaLedgerTransaction.module';
import { PlatformStatusModule } from './modules/platformStatus/platformStatus.module';
import { RateLimiterModule } from './modules/rate-limiter/rate-limiter.module';
import { RateModule } from './modules/rate/rate.module';
import { RateTransactionModule } from './modules/rateTransaction/rateTransaction.module';
import { SupportModule } from './modules/support/support.module';
import { SystemConfigModule } from './modules/systemConfig/systemConfig.module';
import { TierModule } from './modules/tier';
import { TierConfigModule } from './modules/tierConfig';

import { HttpCacheModule } from './interceptors/http-cache';
import { APP_GUARD } from '@nestjs/core';
import { IpMiddleware, WebhookLoggerMiddleware } from './middlewares';
import { AccessBlockMiddleware } from './middlewares/accessBlock.middleware';
import { RequestContextMiddleware } from './middlewares/requestContextMiddleware';
import { PushNotificationTestModule } from './modules/(test)/pushNotification/pushNotification.module';
import { S3BucketModule } from './modules/(test)/s3-bucket(test)/s3-bucket.module';
import { ActivityModule } from './modules/activity/activity.module';
import { AccountActionCodeModule } from './modules/auth/accountActionCode/accountActionCode.module';
import { AccountDeactivationModule } from './modules/auth/accountDeactivation/accountDeactivation.module';
import { RolesGuard } from './modules/auth/guard';
import { NgnAccountRetryModule } from './modules/ngnAccountRetry/ngnAccountRetry.module';
import { ProviderLimitModule } from './modules/providerLimit/providerLimit.module';
import { RateConfigModule } from './modules/rateConfig/rateConfig.module';
import { TransactionMonitoringModule } from './modules/transaction-monitoring/transaction-monitoring.module';
import { TransactionSumModule } from './modules/transaction-sum/transaction-sum.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { UserTierModule } from './modules/userTier/userTier.module';
import { ViewsModule } from './modules/views/views.module';
import { VirtualAccountModule } from './modules/virtualAccount';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { FireblocksWebhookModule } from './modules/webhooks/fireblocks/fireblocks-webhook.module';
import { PagaWebhookModule } from './modules/webhooks/paga/paga-webhook.module';
import { PlaidWebhookModule } from './modules/webhooks/plaid/plaid-webhook.module';
import { RainWebhookModule } from './modules/webhooks/rain/rain-webhook.module';
import { SumsubWebhookModule } from './modules/webhooks/sumsub/sumsub-webhook.module';
import { YellowCardWebhookModule } from './modules/webhooks/yellowcard/yellowcard-webhook.module';
import { ZerohashWebhookModule } from './modules/webhooks/zerohash/zerohash-webhook.module';
import { EventEmitterModule } from './services/eventEmitter/eventEmitter.module';
import { ImageCompressorModule } from './services/imageConpressor';
import { LockerModule } from './services/locker';
import { LoggerModule } from './services/logger/logger.module';
import { PushNotificationModule } from './services/pushNotification/pushNotification.module';
import { ExchangeProcessorModule } from './services/queue/processors/exchange/exchange.processor.module';
import { MailerModule } from './services/queue/processors/mailer/mailer.module';
import { NgnWithdrawalModule } from './services/queue/processors/ngn-withdrawal/ngn-withdrawal.module';
import { SmsModule } from './services/queue/processors/sms/sms.module';
import { VirtualAccountQueueModule } from './services/queue/processors/virtual-account/virtual-account-queue.module';
import { QueueModule } from './services/queue/queue.module';
import { AccessBlockerAttemptModule } from './services/redis/accessBlockerAttempt/accessBlockerAttempt.module';
import { RedisModule } from './services/redis/redis.module';
import { S3Module } from './services/s3';

@Module({
  imports: [
    SentryModule.forRoot(),
    LoggerModule,
    ConfigModule,
    RedisModule,
    HttpCacheModule,
    QueueModule,
    LockerModule,
    MailerModule,
    SmsModule,
    DatabaseModule,
    AuthModule,
    UserRoleModule,
    RoleModule,
    RegisterModule,
    LoginModule,
    ResetPasswordModule,
    AccountVerificationModule,
    RefreshTokenModule,
    UserModule,
    AccountDeleteRequestModule,
    RateLimiterModule,
    KycVerificationModule,
    ZerohashWebhookModule,
    ExternalAccountModule,
    FiatWalletModule,
    FiatWalletTransactionModule,
    TierModule,
    TierConfigModule,
    IpCountryBanModule,
    AccessBlockerAttemptModule,
    TransactionPinModule,
    TransactionPinGuardModule,
    ResetTransactionPinModule,
    WaasModule,
    VirtualAccountModule,
    InAppNotificationModule,
    BlockChainWalletModule,
    TransactionModule,
    TransactionMonitoringModule,
    TransactionSumModule,
    CardAdapterModule,
    CardModule,
    PlaidWebhookModule,
    FireblocksWebhookModule,
    RainWebhookModule,
    SumsubWebhookModule,
    ImageCompressorModule,
    DepositAddressModule,
    DoshPointsModule,
    ExchangeAdapterModule,
    YellowCardWebhookModule,
    ExchangeModule,
    RateTransactionModule,
    BeneficiaryModule,
    ViewsModule,
    UserTierModule,
    PushNotificationModule,
    BankModule,
    S3Module,
    S3BucketModule,
    PushNotificationTestModule,
    ActivityModule,
    EventEmitterModule,
    PagaWebhookModule,
    PagaLedgerAccountModule,
    PagaLedgerTransactionModule,
    RateModule,
    SupportModule,
    SystemConfigModule,
    ExchangeProcessorModule,
    VerificationTokenModule,
    FeatureFlagModule,
    FeatureFlagOverrideModule,
    VirtualAccountQueueModule,
    NgnWithdrawalModule,
    NgnAccountRetryModule,
    AccountDeactivationModule,
    AccountActionCodeModule,
    PlatformStatusModule,
    RateConfigModule,
    ProviderLimitModule,
    WaitlistModule,
  ],

  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware, AccessBlockMiddleware, WebhookLoggerMiddleware).forRoutes('*');

    consumer
      .apply(IpMiddleware)
      .forRoutes(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/login-biometric', method: RequestMethod.POST },
        { path: 'auth/verify-otp', method: RequestMethod.POST },
        { path: 'auth/resend-otp', method: RequestMethod.POST },
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/user', method: RequestMethod.GET },
        { path: 'external-accounts/fund', method: RequestMethod.POST },
        { path: 'external-accounts/withdraw', method: RequestMethod.POST },
        { path: 'exchange/fiat/initiate', method: RequestMethod.POST },
        { path: 'exchange/fiat', method: RequestMethod.POST },
        { path: 'fiat-wallets/exchange', method: RequestMethod.POST },
        { path: 'fiat-wallets/transfer', method: RequestMethod.POST },
        { path: 'card/users', method: RequestMethod.POST },
        { path: 'card', method: RequestMethod.POST },
        { path: 'card/:card_id/reissue', method: RequestMethod.POST },
      );
  }
}
