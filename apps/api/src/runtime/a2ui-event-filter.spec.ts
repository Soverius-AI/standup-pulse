import { AbstractAgent, type BaseEvent } from '@ag-ui/client';
import { from, type Observable } from 'rxjs';
import { withA2UIActivityOnlyRendering } from './a2ui-event-filter';

const events = [
  { type: 'RUN_STARTED', threadId: 'thread-1', runId: 'run-1' },
  {
    type: 'TOOL_CALL_START',
    toolCallId: 'render-1',
    toolCallName: 'render_a2ui',
  },
  {
    type: 'TOOL_CALL_ARGS',
    toolCallId: 'render-1',
    delta: '{"surfaceId":"pulse"}',
  },
  {
    type: 'ACTIVITY_SNAPSHOT',
    messageId: 'a2ui-surface-render-1',
    activityType: 'a2ui-surface',
    content: { a2ui_operations: [] },
  },
  { type: 'TOOL_CALL_END', toolCallId: 'render-1' },
  {
    type: 'TOOL_CALL_RESULT',
    messageId: 'render-result-1',
    toolCallId: 'render-1',
    content: '{"status":"rendered"}',
  },
  { type: 'RUN_FINISHED', threadId: 'thread-1', runId: 'run-1' },
] satisfies BaseEvent[];

class EventAgent extends AbstractAgent {
  constructor() {
    super({ agentId: 'standup-pulse', threadId: 'thread-1' });
  }

  run(): Observable<BaseEvent> {
    return from(events);
  }

  override clone(): EventAgent {
    return new EventAgent();
  }
}

describe('A2UI activity-only filter', () => {
  it('keeps the activity and removes render_a2ui transport events', async () => {
    const registeredAgent = withA2UIActivityOnlyRendering(new EventAgent());
    const requestAgent = registeredAgent.clone();
    const result: BaseEvent[] = [];

    await requestAgent.runAgent(
      { runId: 'run-1' },
      {
        onEvent: ({ event }) => {
          result.push(event);
        },
      },
    );

    expect(result.map((event) => event.type)).toEqual([
      'RUN_STARTED',
      'ACTIVITY_SNAPSHOT',
      'RUN_FINISHED',
    ]);
  });
});
