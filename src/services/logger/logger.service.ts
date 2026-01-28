import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { Logger } from 'winston';
import { LogContext, LogLevel } from '../../config/logging/winston.interface';
import { RequestContext } from '../../config/request-context.config';
import { BusinessEvent, PerformanceMetrics, SecurityEvent } from './logger.interface';

/**
 * Enhanced Logger Service with monitoring capabilities
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService implements LoggerService {
  private context: string = '';
  private defaultMetadata: Record<string, any> = {};

  constructor(private readonly winston: Logger) {}

  /**
   * Set logging context
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Set default metadata for all logs from this instance
   */
  setDefaultMetadata(metadata: Record<string, any>): void {
    this.defaultMetadata = { ...this.defaultMetadata, ...metadata };
  }

  /**
   * Clear default metadata
   */
  clearDefaultMetadata(): void {
    this.defaultMetadata = {};
  }

  /**
   * Enhanced logging with context and metadata
   */
  private enhancedLog(
    level: LogLevel,
    message: string | Record<string, any>,
    context: LogContext = {},
    error?: Error,
  ): void {
    const requestContext = RequestContext.getStore();
    const logData = {
      ...this.defaultMetadata,
      ...context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        stack: error.stack,
      }),
      context: context?.module || this.context || 'Application',
      requestId: context?.requestId || requestContext?.traceId,
      userId: context?.userId || requestContext?.userId,
      method: requestContext?.method,
      url: requestContext?.url,
      operation: context?.operation,
    };

    this.winston.log(level, typeof message === 'string' ? message : JSON.stringify(message), logData);
  }

  /**
   * Standard LoggerService interface implementation
   */
  log(message: string | Record<string, any>, context?: string): void {
    this.enhancedLog(LogLevel.INFO, message, { module: context });
  }

  error(message: string, stack?: string, context?: string): void {
    const error = stack ? new Error(message) : undefined;
    if (error && stack) {
      error.stack = stack;
    }
    this.enhancedLog(LogLevel.ERROR, message, { module: context }, error);
  }

  warn(message: string, context?: string): void {
    this.enhancedLog(LogLevel.WARN, message, { module: context });
  }

  debug(message: string, context?: string): void {
    this.enhancedLog(LogLevel.DEBUG, message, { module: context });
  }

  verbose(message: string, context?: string): void {
    this.enhancedLog(LogLevel.VERBOSE, message, { module: context });
  }

  /**
   * Enhanced logging methods with full context support
   */
  logInfo(message: string, context?: LogContext): void {
    this.enhancedLog(LogLevel.INFO, message, context);
  }

  logError(message: string, error?: Error, context?: LogContext): void {
    this.enhancedLog(LogLevel.ERROR, message, context, error);
  }

  logWarn(message: string, context?: LogContext): void {
    this.enhancedLog(LogLevel.WARN, message, context);
  }

  logDebug(message: string, context?: LogContext): void {
    this.enhancedLog(LogLevel.DEBUG, message, context);
  }

  /**
   * HTTP Request logging
   */
  logHttpRequest(method: string, url: string, statusCode: number, context?: LogContext): void {
    const message = `${method} ${url} ${statusCode}`;
    const metadata = context?.metadata || {};
    delete context?.metadata;

    this.enhancedLog(LogLevel.INFO, message, {
      ...context,
      method,
      url,
      statusCode,
      metadata,
    });
  }

  /**
   * Performance metrics logging
   */
  logPerformanceMetrics(metrics: PerformanceMetrics, context?: LogContext): void {
    const message = `Performance: ${metrics.operation} completed in ${metrics.duration}ms [${metrics.success ? 'SUCCESS' : 'FAILURE'}]`;
    this.enhancedLog(LogLevel.INFO, message, {
      ...context,
      operation: 'performance_metrics',
      metadata: {
        ...metrics,
        ...context?.metadata,
      },
    });
  }

  /**
   * Security event logging
   */
  logSecurityEvent(event: SecurityEvent, context?: LogContext): void {
    const message = `Security Event: ${event.type}`;
    this.enhancedLog(LogLevel.WARN, message, {
      ...context,
      userId: event.userId || context?.userId,
      operation: 'security_event',
      metadata: {
        securityEventType: event.type,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        ...event.details,
        ...context?.metadata,
      },
    });
  }

  /**
   * Business event logging for monitoring business metrics
   */
  logBusinessEvent(event: BusinessEvent, context?: LogContext): void {
    const message = `Business Event: ${event.type}`;
    this.enhancedLog(LogLevel.INFO, message, {
      ...context,
      userId: event.userId || context?.userId,
      operation: 'business_event',
      metadata: {
        businessEventType: event.type,
        amount: event.amount,
        currency: event.currency,
        ...event.details,
        ...context?.metadata,
      },
    });
  }

  /**
   * Database operation logging
   */
  logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    context?: LogContext,
  ): void {
    const message = `DB Operation: ${operation} on ${table} - ${duration}ms [${success ? 'SUCCESS' : 'FAILURE'}]`;
    this.enhancedLog(success ? LogLevel.DEBUG : LogLevel.WARN, message, {
      ...context,
      operation: 'database_operation',
      metadata: {
        dbOperation: operation,
        table,
        duration,
        success,
        ...context?.metadata,
      },
    });
  }

  /**
   * External API call logging
   */
  logExternalApiCall(
    provider: string,
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    context?: LogContext,
  ): void {
    const message = `External API: ${provider} ${method} ${endpoint} ${statusCode} - ${duration}ms`;
    this.enhancedLog(LogLevel.INFO, message, {
      ...context,
      operation: 'external_api_call',
      metadata: {
        provider,
        endpoint,
        method,
        statusCode,
        duration,
        ...context?.metadata,
      },
    });
  }

  /**
   * User action logging
   */
  logUserAction(action: string, userId: string, details: Record<string, any>, context?: LogContext): void {
    const message = `User Action: ${action}`;
    this.enhancedLog(LogLevel.INFO, message, {
      ...context,
      userId,
      operation: 'user_action',
      metadata: {
        action,
        ...details,
        ...context?.metadata,
      },
    });
  }

  /**
   * System event logging
   */
  logSystemEvent(event: string, severity: LogLevel, details: Record<string, any>, context?: LogContext): void {
    const message = `System Event: ${event}`;
    this.enhancedLog(severity, message, {
      ...context,
      operation: 'system_event',
      metadata: {
        systemEvent: event,
        severity,
        ...details,
        ...context?.metadata,
      },
    });
  }

  /**
   * Structured error logging with correlation
   */
  logStructuredError(error: Error, correlationId: string, additionalContext?: Record<string, any>): void {
    this.enhancedLog(
      LogLevel.ERROR,
      `Structured Error: ${error.message}`,
      {
        requestId: correlationId,
        operation: 'structured_error',
        metadata: {
          errorType: error.constructor.name,
          correlationId,
          ...additionalContext,
        },
      },
      error,
    );
  }

  /**
   * Create child logger with inherited context
   */
  createChild(context: string, metadata?: Record<string, any>): AppLoggerService {
    const childLogger = new AppLoggerService(this.winston);
    childLogger.setContext(context);
    if (metadata) {
      childLogger.setDefaultMetadata({ ...this.defaultMetadata, ...metadata });
    } else {
      childLogger.setDefaultMetadata(this.defaultMetadata);
    }
    return childLogger;
  }

  /**
   * Log with custom level
   */
  logWithLevel(level: LogLevel, message: string, context?: LogContext): void {
    this.enhancedLog(level, message, context);
  }
}
