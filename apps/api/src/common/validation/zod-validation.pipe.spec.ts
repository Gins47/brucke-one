import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  it('returns parsed data for valid input', () => {
    const pipe = new ZodValidationPipe(
      z.object({ name: z.string().min(1) }).strict(),
    );

    expect(pipe.transform({ name: 'Main Shelter' })).toEqual({
      name: 'Main Shelter',
    });
  });

  it('returns structured HTTP 400 errors for invalid input', () => {
    const pipe = new ZodValidationPipe(
      z.object({ name: z.string().min(1, 'Name is required') }).strict(),
    );

    let exception: unknown;
    try {
      pipe.transform({ name: '' });
    } catch (error) {
      exception = error;
    }

    expect(exception).toBeInstanceOf(BadRequestException);
    expect((exception as BadRequestException).getStatus()).toBe(400);
    expect((exception as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: 'Request validation failed',
      errors: [
        {
          field: 'name',
          code: 'too_small',
          message: 'Name is required',
        },
      ],
    });
  });

  it('returns Zod coercion results', () => {
    const pipe = new ZodValidationPipe(
      z.object({ capacity: z.coerce.number().int().nonnegative() }).strict(),
    );

    expect(pipe.transform({ capacity: '25' })).toEqual({ capacity: 25 });
  });
});
