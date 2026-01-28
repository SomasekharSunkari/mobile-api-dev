import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { WinstonConfig } from '../../config/logging/winston.config';
import { AppLoggerService } from './logger.service';
import { AxiosLogger } from './axios.logger';

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory: () => WinstonConfig.getWinstonConfig(),
    }),
  ],
  providers: [
    {
      provide: AppLoggerService,
      useFactory: (winston) => new AppLoggerService(winston),
      inject: ['winston'],
    },
    AxiosLogger,
  ],
  exports: [AppLoggerService, AxiosLogger],
})
export class LoggerModule {}
