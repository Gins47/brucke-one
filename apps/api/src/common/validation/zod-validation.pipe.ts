import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Validates a request value with a Zod schema and returns its parsed output. */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new BadRequestException({
      statusCode: 400,
      message: 'Request validation failed',
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }
}
