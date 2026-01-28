import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { isValidRails } from '../constants/blockchainAccountRails';

/**
 * Custom validator decorator for blockchain account rails
 * Validates that the rails value is one of the allowed values from the constants
 */
export function IsValidBlockchainAccountRails(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidBlockchainAccountRails',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        validate(value: any, args: ValidationArguments) {
          return typeof value === 'string' && isValidRails(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid blockchain account rails value`;
        },
      },
    });
  };
}
