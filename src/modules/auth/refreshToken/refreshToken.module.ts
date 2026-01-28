import { forwardRef, Module } from '@nestjs/common';
import { RedisModule } from '../../../services/redis/redis.module';
import { AccessTokenModule } from '../accessToken';
import { AuthModule } from '../auth.module';
import { UserModule } from '../user/user.module';
import { RefreshTokenController } from './refreshToken.controller';
import { RefreshTokenService } from './refreshToken.service';

@Module({
  providers: [RefreshTokenService],
  exports: [RefreshTokenService],
  imports: [forwardRef(() => AuthModule), forwardRef(() => AccessTokenModule), UserModule, RedisModule],
  controllers: [RefreshTokenController],
})
export class RefreshTokenModule {}
