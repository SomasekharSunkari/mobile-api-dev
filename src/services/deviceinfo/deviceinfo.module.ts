import { Module } from '@nestjs/common';
import { DeviceInfoService } from './deviceinfo.service';
import { IpInfoModule } from '../ipinfo/ipinfo.module';

@Module({
  imports: [IpInfoModule],
  providers: [DeviceInfoService],
  exports: [DeviceInfoService],
})
export class DeviceInfoModule {}
