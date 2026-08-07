const A2UI_TOOL_RESULTS_CONTEXT_KEY = 'a2ui:trusted-tool-results';

export interface A2UIToolResult {
  readonly toolName: string;
  readonly result: unknown;
}

interface ReadableRequestContext {
  get(key: string): unknown;
}

interface WritableRequestContext extends ReadableRequestContext {
  set(key: string, value: unknown): void;
}

export function recordA2UIToolResult(
  requestContext: WritableRequestContext,
  toolName: string,
  result: unknown,
): void {
  const results = readA2UIToolResults(requestContext);
  requestContext.set(A2UI_TOOL_RESULTS_CONTEXT_KEY, [
    ...results,
    { toolName, result },
  ] satisfies A2UIToolResult[]);
}

export function readA2UIToolResults(
  requestContext: ReadableRequestContext,
): A2UIToolResult[] {
  const value = requestContext.get(A2UI_TOOL_RESULTS_CONTEXT_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is A2UIToolResult =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { toolName?: unknown }).toolName === 'string' &&
      'result' in entry,
  );
}
