import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export function IsLessThan(
  propertyFunc: string | ((value: any, object: any) => boolean),
  validationOptions?: ValidationOptions,
) {
  return (object: Record<any, any>, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [propertyFunc],
      validator: IsLessThanConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'IsLessThan' })
export class IsLessThanConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const [propertyFunc] = args.constraints;
    let relatedValue;
    if (typeof propertyFunc === 'function') {
      relatedValue = propertyFunc(value, args.object);
    } else if (typeof propertyFunc === 'string') {
      relatedValue = (args.object as any)[propertyFunc];
    }
    return typeof value === 'number' && typeof relatedValue === 'number' && value < relatedValue;
  }
}
