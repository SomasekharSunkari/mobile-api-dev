import { Global, Module } from '@nestjs/common';
import { HttpCacheInterceptor } from './http-cache.interceptor';
import { HttpCacheService } from './http-cache.service';

@Global()
@Module({
  providers: [HttpCacheInterceptor, HttpCacheService],
  exports: [HttpCacheInterceptor, HttpCacheService],
})
export class HttpCacheModule {}
