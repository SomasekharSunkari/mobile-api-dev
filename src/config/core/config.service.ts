import { Logger } from '@nestjs/common';
import { IConfigProvider } from '../core/define-config';

/**
 * A simple logging interface that can be implemented by any logging system
 */
export interface ILogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string, trace?: string): void;
}

/**
 * Main configuration registry
 */
export class ConfigService {
  private static configProviders = new Map<string, IConfigProvider<any>>();
  private static logger: ILogger = new Logger('ConfigService');

  /**
   * Set a custom logger
   *
   * @param logger A logger implementation
   */
  static setLogger(logger: ILogger): void {
    ConfigService.logger = logger;
  }

  /**
   * Register a configuration provider
   *
   * @param name The name of the configuration
   * @param provider The configuration provider instance
   */
  static register<T>(name: string, provider: IConfigProvider<T>): void {
    if (ConfigService.configProviders.has(name)) {
      ConfigService.logger.warn(`Config provider ${name} is being overridden`);
    }

    ConfigService.configProviders.set(name, provider);
    ConfigService.logger.log(`Registered config provider: ${name}`);
  }

  /**
   * Get a configuration by name
   *
   * @param name The name of the configuration to retrieve
   * @returns The configuration object
   */
  static get<T>(name: string): T {
    const provider = ConfigService.configProviders.get(name);

    if (!provider) {
      throw new Error(`Config provider not found: ${name}`);
    }

    return provider.getConfig();
  }

  /**
   * Check if a configuration exists
   *
   * @param name The name of the configuration to check
   * @returns True if the configuration exists
   */
  static has(name: string): boolean {
    return ConfigService.configProviders.has(name);
  }

  /**
   * Get all registered providers
   *
   * @returns A map of all registered providers
   */
  static getProviders(): Map<string, IConfigProvider<any>> {
    return ConfigService.configProviders;
  }

  /**
   * Clear all registered configurations
   */
  static clear(): void {
    ConfigService.configProviders.clear();
    ConfigService.logger.log('All config providers cleared');
  }
}
