import {
  AbstractAgent,
  FilterToolCallsMiddleware,
  type RunAgentInput,
} from '@ag-ui/client';

const A2UI_RENDER_TOOL_NAME = 'render_a2ui';

function createA2UIActivityOnlyMiddleware(): FilterToolCallsMiddleware {
  return new FilterToolCallsMiddleware({
    disallowedToolCalls: [A2UI_RENDER_TOOL_NAME],
  });
}

function cloneAgent(agent: AbstractAgent): AbstractAgent {
  const clone: unknown = agent.clone();
  if (!(clone instanceof AbstractAgent)) {
    throw new TypeError('AG-UI agent clone did not return an agent.');
  }
  return clone;
}

class A2UIActivityOnlyAgent extends AbstractAgent {
  constructor(private readonly delegate: AbstractAgent) {
    super({
      ...(delegate.agentId === undefined ? {} : { agentId: delegate.agentId }),
      description: delegate.description,
      threadId: delegate.threadId,
      debug: delegate.debug,
    });
  }

  run(input: RunAgentInput): ReturnType<AbstractAgent['run']> {
    return createA2UIActivityOnlyMiddleware().run(
      input,
      cloneAgent(this.delegate),
    );
  }

  override clone(): AbstractAgent {
    const requestAgent = cloneAgent(this.delegate);
    requestAgent.use(createA2UIActivityOnlyMiddleware());
    return requestAgent;
  }
}

export function withA2UIActivityOnlyRendering(
  agent: AbstractAgent,
): AbstractAgent {
  return new A2UIActivityOnlyAgent(agent);
}
