import { Module } from '@nestjs/common';
import { IpInfoService } from './ipinfo.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [IpInfoService],
  exports: [IpInfoService],
})
export class IpInfoModule {}
