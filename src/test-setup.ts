import { Logger } from '@nestjs/common';

// Suppress all console output during tests
jest.spyOn(Logger, 'error').mockImplementation(() => {});
jest.spyOn(Logger, 'log').mockImplementation(() => {});
jest.spyOn(Logger, 'warn').mockImplementation(() => {});
jest.spyOn(Logger, 'debug').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

// Mock Logger instance methods for services that create their own logger instances
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});

// Set NODE_ENV to test to enable environment-specific logging suppression
process.env.NODE_ENV = 'test';

// Global cleanup after each test to prevent timer leaks
afterEach(() => {
  jest.useRealTimers();
});

// Global cleanup after all tests to ensure no lingering handles
afterAll(async () => {
  jest.useRealTimers();
  jest.clearAllTimers();
});
