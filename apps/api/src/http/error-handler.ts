import { ErrorResponseSchema } from '@standup-pulse/shared-contracts';
import { StandupDomainError } from '../domain';
import type { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

export function registerErrorHandling(app: Hono): void {
  app.notFound((c) =>
    c.json(
      ErrorResponseSchema.parse({
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      }),
      404,
    ),
  );

  app.onError((error, c) => {
    if (
      error instanceof ZodError ||
      error instanceof SyntaxError ||
      (error instanceof HTTPException && error.status === 400)
    ) {
      return c.json(
        ErrorResponseSchema.parse({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request validation failed',
          },
        }),
        400,
      );
    }
    if (error instanceof StandupDomainError) {
      const status =
        error.code === 'TEAM_NOT_FOUND' || error.code === 'MEMBER_NOT_FOUND'
          ? 404
          : 409;
      return c.json(
        ErrorResponseSchema.parse({
          error: {
            code: error.code,
            message: publicDomainErrorMessage(error.code),
          },
        }),
        status,
      );
    }

    console.error('Unhandled API error', { name: error.name });
    return c.json(
      ErrorResponseSchema.parse({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'The request could not be completed',
        },
      }),
      500,
    );
  });
}

function publicDomainErrorMessage(code: StandupDomainError['code']): string {
  switch (code) {
    case 'TEAM_NOT_FOUND':
      return 'The configured team was not found';
    case 'MEMBER_NOT_FOUND':
      return 'Roster member not found';
    case 'ACTOR_NOT_IN_TEAM':
    case 'EXTERNAL_ACTOR_NOT_LINKED':
      return 'The requesting user is not linked to an active roster member';
    case 'INVALID_TIME_ZONE':
      return 'The configured team time zone is invalid';
    case 'PROACTIVE_DELIVERY_UNAVAILABLE':
      return 'Proactive delivery is unavailable';
  }
}
