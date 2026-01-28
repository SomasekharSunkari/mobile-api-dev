import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { EnvironmentService } from '../../../config';
import { AccessTokenModule } from '../accessToken';
import { JWT_EXPIRATION_MINS } from '../auth.constants';
import { AuthModule } from '../auth.module';
import { LoginDeviceModule } from '../loginDevice/loginDevice.module';
import { LoginEventModule } from '../loginEvent/loginEvent.module';
import { LoginSecurityModule } from '../loginSecurity/loginSecurity.module';
import { RefreshTokenModule } from '../refreshToken';
import { UserModule } from '../user/user.module';
import { UserProfileModule } from '../userProfile/userProfile.module';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';

@Module({
  imports: [
    JwtModule.register({
      secret: EnvironmentService.getValue('JWT_SECRET_TOKEN'),
      signOptions: { expiresIn: `${JWT_EXPIRATION_MINS}hrs` },
    }),
    UserModule,
    UserProfileModule,
    AuthModule,
    LoginDeviceModule,
    LoginEventModule,
    LoginSecurityModule,
    AccessTokenModule,
    RefreshTokenModule,
  ],
  controllers: [LoginController],
  providers: [LoginService],
  exports: [LoginService],
})
export class LoginModule {}
