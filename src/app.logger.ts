import { LogLevel } from '@nestjs/common';
import { EnvironmentService } from './config';

export class AppLoggerConfig {
  static getLoggerLevel(): LogLevel[] {
    return EnvironmentService.getValue('LOGGER_LEVELS');
  }
}
