import { Injectable, Logger } from '@nestjs/common';
import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { Model, ModelClass } from 'objection';

@ValidatorConstraint({ async: true })
@Injectable()
export class UniqueConstraint implements ValidatorConstraintInterface {
  private readonly logger = new Logger(UniqueConstraint.name);
  async validate(value: any, args?: ValidationArguments) {
    //
    if (!value) {
      return false;
    }
    const uniqueTurple = <[ModelClass<Model>, string]>args.constraints;
    const [model, propertyName] = uniqueTurple;
    let dataExist: any;

    try {
      dataExist = await model.query().where(propertyName, value).first();
      //
    } catch (e) {
      this.logger.error(e);
    }

    if (dataExist) {
      return false;
    } else {
      return true;
    }
  }

  defaultMessage(args: ValidationArguments) {
    // here you can provide default error message if validation failed
    const [column] = args.constraints;
    return `${column} not found`;
  }
}

export function IsUnique(model: ModelClass<Model>, validationOptions?: ValidationOptions) {
  return function (object: any, propertyName) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [model, propertyName],
      validator: UniqueConstraint,
    });
  };
}
