/**
 * Base interface for configuration providers
 * Each configuration provider should implement this interface
 */
export interface IConfigProvider<T> {
  getConfig(): T;
}

/**
 * Base class for configuration providers
 * Each configuration provider can extend this class and implement
 * the getConfig method to return its specific configuration
 */
export abstract class ConfigProvider<T> implements IConfigProvider<T> {
  abstract getConfig(): T;
}
