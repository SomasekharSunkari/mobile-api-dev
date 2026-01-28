import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
// eslint-disable-next-line @typescript-eslint/no-require-imports

import { EnvironmentService } from '../environment/environment.service';
import { RequestContext } from '../request-context.config';
import { LogLevel } from './winston.interface';

/**
 * Winston Logger Configuration
 */
export class WinstonConfig {
  private static readonly isDevelopment = EnvironmentService.getValue('NODE_ENV') === 'development';
  private static readonly appName = EnvironmentService.getValue('APP_NAME', 'OneDosh-PaymentsCore');
  private static readonly useColorizedLogs = EnvironmentService.getValue('COLORIZED_LOGS');

  /**
   * Colorized log format with pretty printing
   */
  private static readonly colorizedLogFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, context, stack, ...meta }) => {
      const requestContext = RequestContext.getStore();
      let logMessage = `[${timestamp}] [${level}] [${this.appName}]`;
      if (requestContext?.traceId) {
        logMessage += ` [TraceID: ${requestContext.traceId}]`;
      }
      if (requestContext?.userId) {
        logMessage += ` [UserID: ${requestContext.userId}]`;
      }
      if (requestContext?.method && requestContext?.url) {
        logMessage += ` [${requestContext.method} ${requestContext.url}]`;
      }
      if (requestContext?.appVersion) {
        logMessage += ` [AppVersion: ${requestContext.appVersion}]`;
      }
      if (requestContext?.deviceType) {
        logMessage += ` [DeviceType: ${requestContext.deviceType}]`;
      }
      if (context) {
        logMessage += ` [${context}]`;
      }
      logMessage += `: ${message}`;
      if (Object.keys(meta).length > 0) {
        logMessage += `\n  Metadata: ${JSON.stringify(meta, null, 2)}`;
      }
      if (stack) {
        logMessage += `\n  Stack: ${stack}`;
      }
      return logMessage;
    }),
  );

  /**
   * JSON log format with contextual information
   */
  private static readonly jsonLogFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, context, stack, ...meta }) => {
      const requestContext = RequestContext.getStore();
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        service: this.appName,
        message,
        ...(requestContext?.traceId && { trace_id: requestContext.traceId }),
        ...(requestContext?.userId && { user_id: requestContext.userId }),
        ...(requestContext?.method && { method: requestContext.method }),
        ...(requestContext?.url && { url: requestContext.url }),
        ...(requestContext?.appVersion && { app_version: requestContext.appVersion }),
        ...(requestContext?.deviceType && { device_type: requestContext.deviceType }),
        ...(context && { context }),
        ...(stack && { stack }),
        ...(Object.keys(meta).length > 0 && { metadata: meta }),
      };
      return JSON.stringify(logEntry);
    }),
  );

  /**
   * Custom log format with contextual information
   */
  private static readonly logFormat = this.useColorizedLogs ? this.colorizedLogFormat : this.jsonLogFormat;

  /**
   * Create Winston transports based on environment
   */
  private static createTransports(): winston.transport[] {
    const transports: winston.transport[] = [new winston.transports.Console()];
    // @todo: add cloudwatch transport
    return transports;
  }

  /**
   * Get Winston module configuration
   */
  public static getWinstonConfig(): WinstonModuleOptions {
    return {
      level: this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
      format: this.logFormat,
      transports: this.createTransports(),
      exitOnError: false,
      silent: EnvironmentService.getValue('NODE_ENV') === 'test',
    };
  }

  /**
   * Create custom logger instance for specific use cases
   */
  public static createCustomLogger(options: {
    service?: string;
    level?: LogLevel;
    additionalTransports?: winston.transport[];
  }): winston.Logger {
    const { service = this.appName, level = LogLevel.INFO, additionalTransports = [] } = options;

    const customFormat = this.useColorizedLogs
      ? winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
          winston.format.errors({ stack: true }),
          winston.format.colorize({ all: true }),
          winston.format.printf(({ timestamp, level, message, context, stack, ...meta }) => {
            const requestContext = RequestContext.getStore();
            let logMessage = `[${timestamp}] [${level}] [${service}]`;
            if (requestContext?.traceId) {
              logMessage += ` [TraceID: ${requestContext.traceId}]`;
            }
            if (requestContext?.userId) {
              logMessage += ` [UserID: ${requestContext.userId}]`;
            }
            if (requestContext?.method && requestContext?.url) {
              logMessage += ` [${requestContext.method} ${requestContext.url}]`;
            }
            if (context) {
              logMessage += ` [${context}]`;
            }
            logMessage += `: ${message}`;
            if (Object.keys(meta).length > 0) {
              logMessage += `\n  Metadata: ${JSON.stringify(meta, null, 2)}`;
            }
            if (stack) {
              logMessage += `\n  Stack: ${stack}`;
            }
            return logMessage;
          }),
        )
      : winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
          winston.format.errors({ stack: true }),
          winston.format.json(),
          winston.format.printf(({ timestamp, level, message, context, stack, ...meta }) => {
            const requestContext = RequestContext.getStore();
            const logEntry = {
              timestamp,
              level: level.toUpperCase(),
              service,
              message,
              ...(requestContext?.traceId && { trace_id: requestContext.traceId }),
              ...(requestContext?.userId && { user_id: requestContext.userId }),
              ...(requestContext?.method && { method: requestContext.method }),
              ...(requestContext?.url && { url: requestContext.url }),
              ...(context && { context }),
              ...(stack && { stack }),
              ...(Object.keys(meta).length > 0 && { metadata: meta }),
            };
            return JSON.stringify(logEntry);
          }),
        );

    return winston.createLogger({
      level,
      format: customFormat,
      transports: [...this.createTransports(), ...additionalTransports],
      exitOnError: false,
    });
  }
}
