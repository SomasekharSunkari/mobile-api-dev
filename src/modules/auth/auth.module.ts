import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EnvironmentService } from '../../config';
import { AccessTokenModule } from './accessToken';
import { JWT_EXPIRATION_MINS } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordPawnModule } from './passwordPawn/passwordPawn.module';

import { JwtStrategyService } from './strategies/jwt-strategy.service';
import { UserModule } from './user/user.module';
import { UserProfileModule } from './userProfile/userProfile.module';
import { VerificationTokenModule } from './verificationToken/verificationToken.module';
@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtStrategyService],
  exports: [AuthService, JwtStrategyService, VerificationTokenModule],
  imports: [
    JwtModule.register({
      secret: EnvironmentService.getValue('JWT_SECRET_TOKEN'),
      signOptions: { expiresIn: `${JWT_EXPIRATION_MINS}hrs` },
    }),
    forwardRef(() => AccessTokenModule),
    UserModule,
    UserProfileModule,
    PasswordPawnModule,
    VerificationTokenModule,
  ],
})
export class AuthModule {}
