import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Validates UTF-8 byte length, not character count. Needed where the
 * downstream consumer truncates by bytes (e.g. bcrypt at 72 bytes):
 * multi-byte characters would pass @MaxLength yet lose entropy silently.
 */
export function MaxBytes(
  maxBytes: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'maxBytes',
      target: object.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === 'string' &&
            Buffer.byteLength(value, 'utf8') <= maxBytes
          );
        },
        defaultMessage(): string {
          return `${propertyName.toString()} must not exceed ${maxBytes} bytes`;
        },
      },
    });
  };
}
