import { HttpException, HttpStatus, Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { BaseRepository } from '../database';

@ValidatorConstraint({ async: true })
@Injectable()
export class ExistInConstraint implements ValidatorConstraintInterface {
  async validate(value: string | number, args: ValidationArguments) {
    const [model, column] = args.constraints as [BaseRepository, string];

    try {
      // confirm that column was configure
      if (!column) {
        throw new HttpException(`column must be added first to use decorator`, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // confirm that table was configure
      if (!model) {
        throw new HttpException(`Add model to use in existsIn decorator`, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // validate the value was sent
      if (!value) {
        return false;
      }
      // set table to use for checking the if the entity exists

      const entityExists = await model
        .query()
        .where({ [column]: value })
        .first();

      return entityExists ? true : false;
    } catch (e) {
      throw new InternalServerErrorException({
        message: e.message,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  defaultMessage(args: ValidationArguments) {
    // here you can provide default error message if validation failed
    const [column] = args.constraints;
    return `${column} not found`;
  }
}

export function ExistsIn(repository: BaseRepository, column: string, validationOptions?: ValidationOptions) {
  // const app =
  return function (object: any, propertyName: any) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [repository, column],
      validator: ExistInConstraint,
    });
  };
}
