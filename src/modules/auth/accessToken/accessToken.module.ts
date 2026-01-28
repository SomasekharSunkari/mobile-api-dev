import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth.module';
import { UserModule } from '../user/user.module';
import { AccessTokenService } from './accessToken.service';

@Module({
  providers: [AccessTokenService],
  exports: [AccessTokenService],
  imports: [forwardRef(() => AuthModule), UserModule],
})
export class AccessTokenModule {}
