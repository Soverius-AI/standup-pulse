import { RequestContext } from '@mastra/core/request-context';
import { DEFAULT_TEAM_SCOPE } from '../data';

export function trustedRequestContext(
  actorId: string,
  timeZone: string,
  threadId?: string,
): RequestContext {
  const entries: Array<[string, string]> = [
    ['actorId', actorId],
    ['teamId', DEFAULT_TEAM_SCOPE.teamId],
    ['timezone', timeZone],
  ];
  if (threadId) entries.push(['threadId', threadId]);
  return new RequestContext(entries);
}
