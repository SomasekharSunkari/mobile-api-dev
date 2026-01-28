import { Logger } from '@nestjs/common';

// Suppress all console output during e2e tests
jest.spyOn(Logger, 'error').mockImplementation(() => {});
jest.spyOn(Logger, 'log').mockImplementation(() => {});
jest.spyOn(Logger, 'warn').mockImplementation(() => {});
jest.spyOn(Logger, 'debug').mockImplementation(() => {});
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

// Add global teardown
afterAll(async () => {
  // Force close any remaining connections
  await new Promise((resolve) => setTimeout(resolve, 100));
});
