import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsAdult(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAdult',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          const dob = new Date(value);
          const today = new Date();
          const age =
            today.getFullYear() -
            dob.getFullYear() -
            (today.getMonth() < dob.getMonth() ||
            (today.getMonth() === dob.getMonth() &&
              today.getDate() < dob.getDate())
              ? 1
              : 0);
          return age >= 18;
        },
        defaultMessage() {
          return 'User must be at least 18 years old';
        },
      },
    });
  };
}
