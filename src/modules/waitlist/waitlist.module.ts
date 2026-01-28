import { Module } from '@nestjs/common';
import { WaitlistController } from './waitlist.controller';
import { WaitlistRepository } from './waitlist.repository';
import { WaitlistService } from './waitlist.service';

@Module({
  providers: [WaitlistRepository, WaitlistService],
  exports: [WaitlistService, WaitlistRepository],
  controllers: [WaitlistController],
})
export class WaitlistModule {}
