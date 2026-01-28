import { THROTTLE_MESSAGE_KEY, ThrottleMessage } from './throttle-message.decorator';

describe('ThrottleMessage Decorator', () => {
  it('should set metadata with the provided message', () => {
    const testMessage = 'Custom rate limit message';

    @ThrottleMessage(testMessage)
    class TestClass {}

    const metadata = Reflect.getMetadata(THROTTLE_MESSAGE_KEY, TestClass);
    expect(metadata).toBe(testMessage);
  });

  it('should set metadata on method when used as method decorator', () => {
    const testMessage = 'Method rate limit message';

    class TestClass {
      @ThrottleMessage(testMessage)
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(THROTTLE_MESSAGE_KEY, TestClass.prototype.testMethod);
    expect(metadata).toBe(testMessage);
  });

  it('should handle empty string message', () => {
    const testMessage = '';

    @ThrottleMessage(testMessage)
    class TestClass {}

    const metadata = Reflect.getMetadata(THROTTLE_MESSAGE_KEY, TestClass);
    expect(metadata).toBe('');
  });

  it('should handle message with special characters', () => {
    const testMessage = 'Rate limit exceeded! Please wait 30 seconds before trying again.';

    class TestClass {
      @ThrottleMessage(testMessage)
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(THROTTLE_MESSAGE_KEY, TestClass.prototype.testMethod);
    expect(metadata).toBe(testMessage);
  });

  it('should export the correct metadata key', () => {
    expect(THROTTLE_MESSAGE_KEY).toBe('throttle_message');
  });
});
