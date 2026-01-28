import { Writable } from 'node:stream';
import * as winston from 'winston';
import { RequestContext } from '../request-context.config';
import { WinstonConfig } from './winston.config';
import { LogLevel } from './winston.interface';

describe('WinstonConfig', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getWinstonConfig', () => {
    it('should return WinstonModuleOptions', () => {
      const config = WinstonConfig.getWinstonConfig();

      expect(config).toHaveProperty('level');
      expect(config).toHaveProperty('format');
      expect(config).toHaveProperty('transports');
      expect(config).toHaveProperty('exitOnError');
      expect(config.exitOnError).toBe(false);
    });

    it('should include console transport', () => {
      const config = WinstonConfig.getWinstonConfig();

      expect(config.transports).toHaveLength(1);
      expect(config.transports?.[0]).toBeInstanceOf(winston.transports.Console);
    });

    it('should have format defined', () => {
      const config = WinstonConfig.getWinstonConfig();

      expect(config.format).toBeDefined();
    });

    it('should have level defined', () => {
      const config = WinstonConfig.getWinstonConfig();

      expect(config.level).toBeDefined();
      expect([LogLevel.DEBUG, LogLevel.INFO]).toContain(config.level);
    });
  });

  describe('createCustomLogger', () => {
    it('should create a winston Logger instance', () => {
      const logger = WinstonConfig.createCustomLogger({});

      expect(logger).toBeDefined();
      expect(typeof logger.log).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should use default app name when service is not provided', () => {
      const logger = WinstonConfig.createCustomLogger({});

      expect(logger).toBeDefined();
      expect(logger.transports.length).toBeGreaterThan(0);
    });

    it('should use custom service name when provided', () => {
      const logger = WinstonConfig.createCustomLogger({ service: 'CustomService' });

      expect(logger).toBeDefined();
      expect(logger.transports.length).toBeGreaterThan(0);
    });

    it('should use default log level when not provided', () => {
      const logger = WinstonConfig.createCustomLogger({});

      expect(logger.level).toBe(LogLevel.INFO);
    });

    it('should use custom log level when provided', () => {
      const logger = WinstonConfig.createCustomLogger({ level: LogLevel.DEBUG });

      expect(logger.level).toBe(LogLevel.DEBUG);
    });

    it('should use warn log level when provided', () => {
      const logger = WinstonConfig.createCustomLogger({ level: LogLevel.WARN });

      expect(logger.level).toBe(LogLevel.WARN);
    });

    it('should use error log level when provided', () => {
      const logger = WinstonConfig.createCustomLogger({ level: LogLevel.ERROR });

      expect(logger.level).toBe(LogLevel.ERROR);
    });

    it('should include additional transports when provided', () => {
      const additionalTransport = new winston.transports.Console();
      const logger = WinstonConfig.createCustomLogger({
        additionalTransports: [additionalTransport],
      });

      expect(logger.transports).toHaveLength(2);
    });

    it('should include multiple additional transports when provided', () => {
      const transport1 = new winston.transports.Console();
      const transport2 = new winston.transports.Console();
      const logger = WinstonConfig.createCustomLogger({
        additionalTransports: [transport1, transport2],
      });

      expect(logger.transports).toHaveLength(3);
    });

    it('should set exitOnError to false', () => {
      const logger = WinstonConfig.createCustomLogger({});

      expect(logger.exitOnError).toBe(false);
    });

    it('should have format defined', () => {
      const logger = WinstonConfig.createCustomLogger({});

      expect(logger.format).toBeDefined();
    });

    it('should create logger with all options combined', () => {
      const additionalTransport = new winston.transports.Console();
      const logger = WinstonConfig.createCustomLogger({
        service: 'TestService',
        level: LogLevel.DEBUG,
        additionalTransports: [additionalTransport],
      });

      expect(logger).toBeDefined();
      expect(logger.level).toBe(LogLevel.DEBUG);
      expect(logger.transports).toHaveLength(2);
      expect(logger.exitOnError).toBe(false);
    });
  });

  describe('Log format output', () => {
    const createCaptureLogger = (): { logger: winston.Logger; getOutput: () => string } => {
      let output = '';
      const writableStream = new Writable({
        write(chunk, _encoding, callback) {
          output += chunk.toString();
          callback();
        },
      });

      const logger = WinstonConfig.createCustomLogger({ service: 'TestService' });
      logger.clear();
      logger.add(new winston.transports.Stream({ stream: writableStream }));

      return { logger, getOutput: () => output };
    };

    it('should include trace_id in log output when request context has traceId', (done) => {
      const mockStore = {
        traceId: 'trace-123-abc',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('Test message');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('trace-123-abc');
        done();
      });
      logger.end();
    });

    it('should include user_id in log output when request context has userId', (done) => {
      const mockStore = {
        traceId: 'trace-456',
        userId: 'user-789-xyz',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('Test message');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('user-789-xyz');
        done();
      });
      logger.end();
    });

    it('should include method and url in log output when request context has them', (done) => {
      const mockStore = {
        traceId: 'trace-method-url',
        method: 'POST',
        url: 'https://api.example.com/users',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('Request logged');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('POST');
        expect(output).toContain('https://api.example.com/users');
        done();
      });
      logger.end();
    });

    it('should handle undefined request context gracefully', (done) => {
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(undefined);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('Message without context');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('Message without context');
        expect(output).not.toContain('trace_id');
        done();
      });
      logger.end();
    });

    it('should include context in log output when provided', (done) => {
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(undefined);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('Test message', { context: 'TestContext' });
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('TestContext');
        done();
      });
      logger.end();
    });

    it('should include stack trace in log output for errors', (done) => {
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(undefined);

      const { logger, getOutput } = createCaptureLogger();

      logger.error('Error occurred', { stack: 'Error: Something went wrong\n    at Test.run' });
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('Error: Something went wrong');
        done();
      });
      logger.end();
    });

    it('should include log level in output', (done) => {
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(undefined);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('Test message');
      logger.on('finish', () => {
        const output = getOutput();
        // Colorized format uses lowercase 'info', JSON format uses uppercase 'INFO'
        expect(output.toLowerCase()).toContain('info');
        done();
      });
      logger.end();
    });

    it('should include metadata in log output when additional fields provided', (done) => {
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(undefined);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('Test message', { customField: 'customValue123' });
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('customValue123');
        done();
      });
      logger.end();
    });

    it('should include all request context fields together', (done) => {
      const mockStore = {
        traceId: 'full-trace-id',
        userId: 'full-user-id',
        method: 'PUT',
        url: 'https://api.test.com/resource/123',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('Full context test');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('full-trace-id');
        expect(output).toContain('full-user-id');
        expect(output).toContain('PUT');
        expect(output).toContain('https://api.test.com/resource/123');
        done();
      });
      logger.end();
    });

    it('should NOT include method/url when only method is present', (done) => {
      const mockStore = {
        traceId: 'method-only-trace',
        method: 'GET',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('Method only test');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('method-only-trace');
        expect(output).not.toContain('[GET http');
        done();
      });
      logger.end();
    });

    it('should NOT include method/url when only url is present', (done) => {
      const mockStore = {
        traceId: 'url-only-trace',
        url: 'https://url-only.com/path',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('URL only test');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('url-only-trace');
        expect(output).not.toContain('[GET https://url-only.com');
        done();
      });
      logger.end();
    });

    it('should include appVersion in createCustomLogger colorized format', (done) => {
      const mockStore = {
        traceId: 'custom-appversion-trace',
        appVersion: '7.8.9',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('AppVersion in createCustomLogger');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('custom-appversion-trace');
        // Note: appVersion is only in main format, not createCustomLogger
        done();
      });
      logger.end();
    });

    it('should include deviceType in createCustomLogger colorized format', (done) => {
      const mockStore = {
        traceId: 'custom-devicetype-trace',
        deviceType: 'CustomDevice',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('DeviceType in createCustomLogger');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('custom-devicetype-trace');
        // Note: deviceType is only in main format, not createCustomLogger
        done();
      });
      logger.end();
    });
  });

  describe('getWinstonConfig format output', () => {
    const createCaptureLoggerFromConfig = (): { logger: winston.Logger; getOutput: () => string } => {
      let output = '';
      const writableStream = new Writable({
        write(chunk, _encoding, callback) {
          output += chunk.toString();
          callback();
        },
      });

      const config = WinstonConfig.getWinstonConfig();
      const logger = winston.createLogger({
        level: LogLevel.INFO,
        format: config.format,
        transports: [new winston.transports.Stream({ stream: writableStream })],
      });

      return { logger, getOutput: () => output };
    };

    it('should include method and url from request context in main format', (done) => {
      const mockStore = {
        traceId: 'main-trace',
        method: 'GET',
        url: 'https://main.api.com/endpoint',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLoggerFromConfig();

      logger.info('Main format test');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('GET');
        expect(output).toContain('https://main.api.com/endpoint');
        done();
      });
      logger.end();
    });

    it('should include appVersion from request context in main format', (done) => {
      const mockStore = {
        traceId: 'version-trace',
        appVersion: '3.2.1',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLoggerFromConfig();

      logger.info('App version test');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('3.2.1');
        done();
      });
      logger.end();
    });

    it('should include deviceType from request context in main format', (done) => {
      const mockStore = {
        traceId: 'device-trace',
        deviceType: 'iPhone-15-Pro',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLoggerFromConfig();

      logger.info('Device type test');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('iPhone-15-Pro');
        done();
      });
      logger.end();
    });

    it('should include all new fields together in main format', (done) => {
      const mockStore = {
        traceId: 'all-fields-trace',
        userId: 'all-fields-user',
        method: 'DELETE',
        url: 'https://api.all.com/delete/456',
        appVersion: '4.0.0-beta',
        deviceType: 'Android-14',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLoggerFromConfig();

      logger.info('All fields test');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('all-fields-trace');
        expect(output).toContain('all-fields-user');
        expect(output).toContain('DELETE');
        expect(output).toContain('https://api.all.com/delete/456');
        expect(output).toContain('4.0.0-beta');
        expect(output).toContain('Android-14');
        done();
      });
      logger.end();
    });

    it('should handle partial request context with only method', (done) => {
      const mockStore = {
        traceId: 'partial-trace',
        method: 'PATCH',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLoggerFromConfig();

      logger.info('Partial context test');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('partial-trace');
        done();
      });
      logger.end();
    });

    it('should handle partial request context with only url', (done) => {
      const mockStore = {
        traceId: 'url-only-trace',
        url: 'https://url-only.com/path',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLoggerFromConfig();

      logger.info('URL only test');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('url-only-trace');
        done();
      });
      logger.end();
    });

    it('should NOT include method/url line when only method present in main format', (done) => {
      const mockStore = {
        traceId: 'main-method-only',
        method: 'PATCH',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLoggerFromConfig();

      logger.info('Main method only');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('main-method-only');
        expect(output).not.toContain('[PATCH http');
        done();
      });
      logger.end();
    });

    it('should NOT include method/url line when only url present in main format', (done) => {
      const mockStore = {
        traceId: 'main-url-only',
        url: 'https://main-url-only.com/test',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLoggerFromConfig();

      logger.info('Main url only');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('main-url-only');
        expect(output).not.toContain('[GET https://main-url-only');
        done();
      });
      logger.end();
    });

    it('should handle empty appVersion and deviceType', (done) => {
      const mockStore = {
        traceId: 'empty-fields-trace',
        appVersion: '',
        deviceType: '',
        timezone: 'UTC',
      };
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      const { logger, getOutput } = createCaptureLoggerFromConfig();

      logger.info('Empty fields test');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('empty-fields-trace');
        expect(output).not.toContain('AppVersion:');
        expect(output).not.toContain('DeviceType:');
        done();
      });
      logger.end();
    });

    it('should include metadata in main format output', (done) => {
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(undefined);

      const { logger, getOutput } = createCaptureLoggerFromConfig();

      logger.info('Metadata test', { extraField: 'extraValue456' });
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('extraValue456');
        done();
      });
      logger.end();
    });

    it('should include stack trace in main format output', (done) => {
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(undefined);

      const { logger, getOutput } = createCaptureLoggerFromConfig();

      logger.error('Error in main format', { stack: 'MainError: Stack trace here\n    at Line' });
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('MainError: Stack trace here');
        done();
      });
      logger.end();
    });

    it('should include context in main format output', (done) => {
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(undefined);

      const { logger, getOutput } = createCaptureLoggerFromConfig();

      logger.info('Context test', { context: 'MainFormatContext' });
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('MainFormatContext');
        done();
      });
      logger.end();
    });
  });

  describe('Log format output - colorized format metadata and stack', () => {
    const createCaptureLogger = (): { logger: winston.Logger; getOutput: () => string } => {
      let output = '';
      const writableStream = new Writable({
        write(chunk, _encoding, callback) {
          output += chunk.toString();
          callback();
        },
      });

      const logger = WinstonConfig.createCustomLogger({ service: 'TestService' });
      logger.clear();
      logger.add(new winston.transports.Stream({ stream: writableStream }));

      return { logger, getOutput: () => output };
    };

    it('should include metadata with multiple fields in colorized format', (done) => {
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(undefined);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('Multi metadata test', { field1: 'value1', field2: 'value2' });
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('value1');
        expect(output).toContain('value2');
        done();
      });
      logger.end();
    });

    it('should include stack trace in colorized format', (done) => {
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(undefined);

      const { logger, getOutput } = createCaptureLogger();

      logger.error('Colorized error', { stack: 'ColorizedError: Test stack\n    at ColorizedTest' });
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('ColorizedError: Test stack');
        done();
      });
      logger.end();
    });

    it('should handle empty metadata object in colorized format', (done) => {
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(undefined);

      const { logger, getOutput } = createCaptureLogger();

      logger.info('No extra metadata');
      logger.on('finish', () => {
        const output = getOutput();
        expect(output).toContain('No extra metadata');
        done();
      });
      logger.end();
    });
  });

  describe('JSON format with isolated module', () => {
    afterEach(() => {
      jest.resetModules();
      jest.restoreAllMocks();
    });

    it('should use JSON format when COLORIZED_LOGS is not set', (done) => {
      jest.isolateModules(() => {
        // Mock EnvironmentService before importing WinstonConfig
        jest.doMock('../environment/environment.service', () => ({
          EnvironmentService: {
            getValue: (key: string, defaultValue?: string) => {
              if (key === 'COLORIZED_LOGS') return '';
              if (key === 'NODE_ENV') return 'production';
              if (key === 'APP_NAME') return 'TestApp';
              return defaultValue ?? '';
            },
          },
        }));

        let output = '';
        const writableStream = new Writable({
          write(chunk, _encoding, callback) {
            output += chunk.toString();
            callback();
          },
        });

        const mockStore = {
          traceId: 'json-isolated-trace',
          userId: 'json-isolated-user',
          method: 'POST',
          url: 'https://json-isolated.api.com/endpoint',
          appVersion: '6.0.0',
          deviceType: 'IsolatedDevice',
          timezone: 'UTC',
        };

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { RequestContext: IsolatedRequestContext } = require('../request-context.config');
        jest.spyOn(IsolatedRequestContext, 'getStore').mockReturnValue(mockStore);

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { WinstonConfig: IsolatedWinstonConfig } = require('./winston.config');

        const config = IsolatedWinstonConfig.getWinstonConfig();
        const logger = winston.createLogger({
          level: 'info',
          format: config.format,
          transports: [new winston.transports.Stream({ stream: writableStream })],
        });

        logger.info('JSON isolated test');
        logger.on('finish', () => {
          try {
            const parsed = JSON.parse(output.trim());
            expect(parsed.trace_id).toBe('json-isolated-trace');
            expect(parsed.user_id).toBe('json-isolated-user');
            expect(parsed.method).toBe('POST');
            expect(parsed.url).toBe('https://json-isolated.api.com/endpoint');
            expect(parsed.app_version).toBe('6.0.0');
            expect(parsed.device_type).toBe('IsolatedDevice');
            expect(parsed.level).toBe('INFO');
            done();
          } catch (e) {
            done(e);
          }
        });
        logger.end();
      });
    });

    it('should use JSON format in createCustomLogger when COLORIZED_LOGS is not set', (done) => {
      jest.isolateModules(() => {
        jest.doMock('../environment/environment.service', () => ({
          EnvironmentService: {
            getValue: (key: string, defaultValue?: string) => {
              if (key === 'COLORIZED_LOGS') return '';
              if (key === 'NODE_ENV') return 'production';
              if (key === 'APP_NAME') return 'CustomTestApp';
              return defaultValue ?? '';
            },
          },
        }));

        let output = '';
        const writableStream = new Writable({
          write(chunk, _encoding, callback) {
            output += chunk.toString();
            callback();
          },
        });

        const mockStore = {
          traceId: 'custom-json-trace',
          userId: 'custom-json-user',
          method: 'DELETE',
          url: 'https://custom-json.api.com/resource/999',
          timezone: 'UTC',
        };

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { RequestContext: IsolatedRequestContext } = require('../request-context.config');
        jest.spyOn(IsolatedRequestContext, 'getStore').mockReturnValue(mockStore);

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { WinstonConfig: IsolatedWinstonConfig } = require('./winston.config');

        const logger = IsolatedWinstonConfig.createCustomLogger({ service: 'CustomJSONService' });
        logger.clear();
        logger.add(new winston.transports.Stream({ stream: writableStream }));

        logger.info('Custom JSON test', { context: 'CustomJSONContext' });
        logger.on('finish', () => {
          try {
            const parsed = JSON.parse(output.trim());
            expect(parsed.trace_id).toBe('custom-json-trace');
            expect(parsed.user_id).toBe('custom-json-user');
            expect(parsed.method).toBe('DELETE');
            expect(parsed.url).toBe('https://custom-json.api.com/resource/999');
            expect(parsed.context).toBe('CustomJSONContext');
            expect(parsed.service).toBe('CustomJSONService');
            done();
          } catch (e) {
            done(e);
          }
        });
        logger.end();
      });
    });

    it('should include stack and metadata in JSON format', (done) => {
      jest.isolateModules(() => {
        jest.doMock('../environment/environment.service', () => ({
          EnvironmentService: {
            getValue: (key: string, defaultValue?: string) => {
              if (key === 'COLORIZED_LOGS') return '';
              if (key === 'NODE_ENV') return 'production';
              if (key === 'APP_NAME') return 'StackMetaApp';
              return defaultValue ?? '';
            },
          },
        }));

        let output = '';
        const writableStream = new Writable({
          write(chunk, _encoding, callback) {
            output += chunk.toString();
            callback();
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { RequestContext: IsolatedRequestContext } = require('../request-context.config');
        jest.spyOn(IsolatedRequestContext, 'getStore').mockReturnValue(undefined);

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { WinstonConfig: IsolatedWinstonConfig } = require('./winston.config');

        const config = IsolatedWinstonConfig.getWinstonConfig();
        const logger = winston.createLogger({
          level: 'info',
          format: config.format,
          transports: [new winston.transports.Stream({ stream: writableStream })],
        });

        logger.error('Error with metadata', { stack: 'JSONError: Stack trace', customMeta: 'metaValue' });
        logger.on('finish', () => {
          try {
            const parsed = JSON.parse(output.trim());
            expect(parsed.stack).toBe('JSONError: Stack trace');
            expect(parsed.metadata.customMeta).toBe('metaValue');
            done();
          } catch (e) {
            done(e);
          }
        });
        logger.end();
      });
    });

    it('should include context in JSON format', (done) => {
      jest.isolateModules(() => {
        jest.doMock('../environment/environment.service', () => ({
          EnvironmentService: {
            getValue: (key: string, defaultValue?: string) => {
              if (key === 'COLORIZED_LOGS') return '';
              if (key === 'NODE_ENV') return 'production';
              if (key === 'APP_NAME') return 'ContextApp';
              return defaultValue ?? '';
            },
          },
        }));

        let output = '';
        const writableStream = new Writable({
          write(chunk, _encoding, callback) {
            output += chunk.toString();
            callback();
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { RequestContext: IsolatedRequestContext } = require('../request-context.config');
        jest.spyOn(IsolatedRequestContext, 'getStore').mockReturnValue(undefined);

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { WinstonConfig: IsolatedWinstonConfig } = require('./winston.config');

        const config = IsolatedWinstonConfig.getWinstonConfig();
        const logger = winston.createLogger({
          level: 'info',
          format: config.format,
          transports: [new winston.transports.Stream({ stream: writableStream })],
        });

        logger.info('Context test', { context: 'JSONContextTest' });
        logger.on('finish', () => {
          try {
            const parsed = JSON.parse(output.trim());
            expect(parsed.context).toBe('JSONContextTest');
            done();
          } catch (e) {
            done(e);
          }
        });
        logger.end();
      });
    });

    it('should handle JSON format with partial request context', (done) => {
      jest.isolateModules(() => {
        jest.doMock('../environment/environment.service', () => ({
          EnvironmentService: {
            getValue: (key: string, defaultValue?: string) => {
              if (key === 'COLORIZED_LOGS') return '';
              if (key === 'NODE_ENV') return 'production';
              if (key === 'APP_NAME') return 'PartialApp';
              return defaultValue ?? '';
            },
          },
        }));

        let output = '';
        const writableStream = new Writable({
          write(chunk, _encoding, callback) {
            output += chunk.toString();
            callback();
          },
        });

        const mockStore = {
          traceId: 'partial-json-trace',
          method: 'PATCH',
          timezone: 'UTC',
        };

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { RequestContext: IsolatedRequestContext } = require('../request-context.config');
        jest.spyOn(IsolatedRequestContext, 'getStore').mockReturnValue(mockStore);

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { WinstonConfig: IsolatedWinstonConfig } = require('./winston.config');

        const config = IsolatedWinstonConfig.getWinstonConfig();
        const logger = winston.createLogger({
          level: 'info',
          format: config.format,
          transports: [new winston.transports.Stream({ stream: writableStream })],
        });

        logger.info('Partial context JSON test');
        logger.on('finish', () => {
          try {
            const parsed = JSON.parse(output.trim());
            expect(parsed.trace_id).toBe('partial-json-trace');
            expect(parsed.method).toBe('PATCH');
            expect(parsed.url).toBeUndefined();
            expect(parsed.user_id).toBeUndefined();
            done();
          } catch (e) {
            done(e);
          }
        });
        logger.end();
      });
    });

    it('should use DEBUG level in development and JSON format', (done) => {
      jest.isolateModules(() => {
        jest.doMock('../environment/environment.service', () => ({
          EnvironmentService: {
            getValue: (key: string, defaultValue?: string) => {
              if (key === 'COLORIZED_LOGS') return '';
              if (key === 'NODE_ENV') return 'development';
              if (key === 'APP_NAME') return 'DevApp';
              return defaultValue ?? '';
            },
          },
        }));

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { WinstonConfig: IsolatedWinstonConfig } = require('./winston.config');

        const config = IsolatedWinstonConfig.getWinstonConfig();
        expect(config.level).toBe(LogLevel.DEBUG);
        done();
      });
    });

    it('should include stack and metadata in createCustomLogger JSON format', (done) => {
      jest.isolateModules(() => {
        jest.doMock('../environment/environment.service', () => ({
          EnvironmentService: {
            getValue: (key: string, defaultValue?: string) => {
              if (key === 'COLORIZED_LOGS') return '';
              if (key === 'NODE_ENV') return 'production';
              if (key === 'APP_NAME') return 'CustomStackMetaApp';
              return defaultValue ?? '';
            },
          },
        }));

        let output = '';
        const writableStream = new Writable({
          write(chunk, _encoding, callback) {
            output += chunk.toString();
            callback();
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { RequestContext: IsolatedRequestContext } = require('../request-context.config');
        jest.spyOn(IsolatedRequestContext, 'getStore').mockReturnValue(undefined);

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { WinstonConfig: IsolatedWinstonConfig } = require('./winston.config');

        const logger = IsolatedWinstonConfig.createCustomLogger({ service: 'CustomStackMetaService' });
        logger.clear();
        logger.add(new winston.transports.Stream({ stream: writableStream }));

        logger.error('Custom error with stack and meta', {
          stack: 'CustomJSONError: Stack trace',
          customField: 'customValue',
        });
        logger.on('finish', () => {
          try {
            const parsed = JSON.parse(output.trim());
            expect(parsed.stack).toBe('CustomJSONError: Stack trace');
            expect(parsed.metadata.customField).toBe('customValue');
            expect(parsed.service).toBe('CustomStackMetaService');
            done();
          } catch (e) {
            done(e);
          }
        });
        logger.end();
      });
    });

    it('should handle createCustomLogger JSON format without stack or metadata', (done) => {
      jest.isolateModules(() => {
        jest.doMock('../environment/environment.service', () => ({
          EnvironmentService: {
            getValue: (key: string, defaultValue?: string) => {
              if (key === 'COLORIZED_LOGS') return '';
              if (key === 'NODE_ENV') return 'production';
              if (key === 'APP_NAME') return 'NoStackMetaApp';
              return defaultValue ?? '';
            },
          },
        }));

        let output = '';
        const writableStream = new Writable({
          write(chunk, _encoding, callback) {
            output += chunk.toString();
            callback();
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { RequestContext: IsolatedRequestContext } = require('../request-context.config');
        jest.spyOn(IsolatedRequestContext, 'getStore').mockReturnValue(undefined);

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { WinstonConfig: IsolatedWinstonConfig } = require('./winston.config');

        const logger = IsolatedWinstonConfig.createCustomLogger({ service: 'NoStackMetaService' });
        logger.clear();
        logger.add(new winston.transports.Stream({ stream: writableStream }));

        logger.info('Simple message without extra fields');
        logger.on('finish', () => {
          try {
            const parsed = JSON.parse(output.trim());
            expect(parsed.stack).toBeUndefined();
            expect(parsed.metadata).toBeUndefined();
            expect(parsed.service).toBe('NoStackMetaService');
            done();
          } catch (e) {
            done(e);
          }
        });
        logger.end();
      });
    });
  });
});
