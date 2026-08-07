import { zValidator } from '@hono/zod-validator';
import type { ZodSchema } from 'zod';

// The default zValidator hook responds with raw Zod issues, which would leak
// field names and constraints to callers. Throwing instead routes every
// validation failure through the sanitizing error handler.
export function jsonBody<T extends ZodSchema>(schema: T) {
  return zValidator('json', schema, (result) => {
    if (!result.success) throw result.error;
  });
}
