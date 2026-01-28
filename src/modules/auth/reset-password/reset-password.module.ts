import { Module } from '@nestjs/common';
import { AccessTokenModule } from '../accessToken';
import { TransactionPinModule } from '../transactionPin/transactionPin.module';
import { UserModule } from '../user/user.module';
import { ResetPasswordController } from './reset-password.controller';
import { ResetPasswordEvent } from './reset-password.event';
import { ResetPasswordRepository } from './reset-password.repository';
import { ResetPasswordService } from './reset-password.service';

@Module({
  imports: [UserModule, AccessTokenModule, TransactionPinModule],
  controllers: [ResetPasswordController],
  providers: [ResetPasswordRepository, ResetPasswordService, ResetPasswordEvent],
  exports: [ResetPasswordRepository, ResetPasswordService],
})
export class ResetPasswordModule {}
