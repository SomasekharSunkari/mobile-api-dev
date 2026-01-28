import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'NoSpaces' })
export class NoSpacesConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    if (typeof value !== 'string') {
      return true;
    }
    return !value.includes(' ');
  }

  defaultMessage() {
    return 'Field cannot contain spaces';
  }
}

export function NoSpaces(validationOptions?: ValidationOptions) {
  return (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: NoSpacesConstraint,
    });
  };
}
