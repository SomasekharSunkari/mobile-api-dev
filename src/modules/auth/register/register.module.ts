import { Module } from '@nestjs/common';
import { CountryModule } from '../../country';
import { DoshPointsModule } from '../../doshPoints/doshPoints.module';
import { InAppNotificationModule } from '../../inAppNotification';
import { AccessTokenModule } from '../accessToken';
import { AccountVerificationModule } from '../accountVerification/accountVerification.module';
import { AuthModule } from '../auth.module';
import { LoginDeviceModule } from '../loginDevice/loginDevice.module';
import { LoginSecurityModule } from '../loginSecurity/loginSecurity.module';
import { RefreshTokenModule } from '../refreshToken';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { UserProfileModule } from '../userProfile/userProfile.module';
import { UserRoleModule } from '../userRole/user_role.module';
import { RegisterController } from './register.controller';
import { RegisterService } from './register.service';

@Module({
  imports: [
    UserModule,
    UserProfileModule,
    AuthModule,
    LoginDeviceModule,
    LoginSecurityModule,
    RoleModule,
    UserRoleModule,
    AccountVerificationModule,
    CountryModule,
    AccessTokenModule,
    RefreshTokenModule,
    InAppNotificationModule,
    DoshPointsModule,
  ],
  controllers: [RegisterController],
  providers: [RegisterService],
})
export class RegisterModule {}
