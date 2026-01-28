import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { THROTTLE_MESSAGE_KEY } from '../../decorators/throttle-message.decorator';
import { CustomThrottlerGuard } from './custom-throttler.guard';

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;
  let reflector: Reflector;
  let mockExecutionContext: ExecutionContext;

  const createMockExecutionContext = (): ExecutionContext => {
    const mockHandler = jest.fn();
    const mockClass = class TestController {};

    return {
      getHandler: jest.fn().mockReturnValue(mockHandler),
      getClass: jest.fn().mockReturnValue(mockClass),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          method: 'GET',
          url: '/test',
          ip: '127.0.0.1',
          route: { path: '/test' },
        }),
        getResponse: jest.fn().mockReturnValue({
          header: jest.fn(),
        }),
      }),
      getType: jest.fn().mockReturnValue('http'),
      getArgs: jest.fn().mockReturnValue([]),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();

    const mockOptions: ThrottlerModuleOptions = {
      throttlers: [{ name: 'default', ttl: 60000, limit: 10 }],
    };

    const mockStorageService: ThrottlerStorage = {
      increment: jest.fn().mockResolvedValue({ totalHits: 1, timeToExpire: 60000 }),
      get: jest.fn(),
      set: jest.fn(),
    } as unknown as ThrottlerStorage;

    guard = new CustomThrottlerGuard(mockOptions, mockStorageService, reflector);

    mockExecutionContext = createMockExecutionContext();
  });

  describe('throwThrottlingException', () => {
    it('should throw ThrottlerException with custom message when decorator is present', () => {
      const customMessage = 'You have exceeded the rate limit. Please wait.';

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(customMessage);

      expect(() => {
        (guard as any).throwThrottlingException(mockExecutionContext);
      }).toThrow(ThrottlerException);

      expect(() => {
        (guard as any).throwThrottlingException(mockExecutionContext);
      }).toThrow(customMessage);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(THROTTLE_MESSAGE_KEY, [
        mockExecutionContext.getHandler(),
        mockExecutionContext.getClass(),
      ]);
    });

    it('should throw ThrottlerException with undefined when no custom message is set', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      expect(() => {
        (guard as any).throwThrottlingException(mockExecutionContext);
      }).toThrow(ThrottlerException);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(THROTTLE_MESSAGE_KEY, [
        mockExecutionContext.getHandler(),
        mockExecutionContext.getClass(),
      ]);
    });

    it('should check both handler and class for custom message', () => {
      const customMessage = 'Class-level throttle message';

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(customMessage);

      expect(() => {
        (guard as any).throwThrottlingException(mockExecutionContext);
      }).toThrow(customMessage);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(THROTTLE_MESSAGE_KEY, [
        mockExecutionContext.getHandler(),
        mockExecutionContext.getClass(),
      ]);
    });

    it('should throw ThrottlerException with empty string when decorator has empty message', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('');

      expect(() => {
        (guard as any).throwThrottlingException(mockExecutionContext);
      }).toThrow(ThrottlerException);
    });

    it('should handle message with special characters', () => {
      const specialMessage = 'Rate limit exceeded! Wait 30s before retrying (max: 5 attempts).';

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(specialMessage);

      expect(() => {
        (guard as any).throwThrottlingException(mockExecutionContext);
      }).toThrow(specialMessage);
    });
  });

  describe('guard instantiation', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should have throwThrottlingException method', () => {
      expect((guard as any).throwThrottlingException).toBeDefined();
      expect(typeof (guard as any).throwThrottlingException).toBe('function');
    });
  });
});
