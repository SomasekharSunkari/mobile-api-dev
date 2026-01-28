import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export function IsGreaterThan(
  propertyFunc: string | ((value: any, object: any) => any),
  validationOptions?: ValidationOptions,
) {
  return (object: Record<any, any>, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [propertyFunc],
      validator: IsGreaterThanConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'IsGreaterThan' })
export class IsGreaterThanConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const [propertyFunc] = args.constraints;
    let relatedValue;
    if (typeof propertyFunc === 'function') {
      relatedValue = propertyFunc(value, args.object);
      return relatedValue;
    } else if (typeof propertyFunc === 'string') {
      relatedValue = (args.object as any)[propertyFunc];
    }
    return typeof value === 'number' && typeof relatedValue === 'number' && value > relatedValue;
  }
}
