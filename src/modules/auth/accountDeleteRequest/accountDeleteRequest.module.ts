import { Module } from '@nestjs/common';
import { AccessTokenModule } from '../accessToken/accessToken.module';
import { AccountActionCodeModule } from '../accountActionCode/accountActionCode.module';
import { LoginDeviceModule } from '../loginDevice/loginDevice.module';
import { LoginEventModule } from '../loginEvent';
import { RefreshTokenModule } from '../refreshToken/refreshToken.module';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { UserRoleModule } from '../userRole/user_role.module';
import { AccountDeleteRequestController } from './accountDeleteRequest.controller';
import { AccountDeleteRequestRepository } from './accountDeleteRequest.repository';
import { AccountDeleteRequestService } from './accountDeleteRequest.service';

@Module({
  imports: [
    UserModule,
    UserRoleModule,
    RoleModule,
    AccessTokenModule,
    RefreshTokenModule,
    LoginDeviceModule,
    LoginEventModule,
    AccountActionCodeModule,
  ],
  controllers: [AccountDeleteRequestController],
  providers: [AccountDeleteRequestRepository, AccountDeleteRequestService],
  exports: [AccountDeleteRequestRepository, AccountDeleteRequestService],
})
export class AccountDeleteRequestModule {}
