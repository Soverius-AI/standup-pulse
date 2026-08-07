export function readableError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The daily pulse could not be loaded. Try again in a moment.';
}
