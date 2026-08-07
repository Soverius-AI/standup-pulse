import { v5 as uuidv5 } from 'uuid';
import type { IsoDate, NudgeResponse } from '@standup-pulse/shared-contracts';

// Changing this namespace changes every derived client_msg_id, which would
// defeat Slack's duplicate detection for deliveries already in flight.
const CLIENT_MESSAGE_NAMESPACE = 'a5b7c1e4-3f2d-4a86-9c58-1e7d2b90f314';

export type NudgeDelivery = NudgeResponse['deliveries'][number];

export function stableClientMessageId(idempotencyKey: string): string {
  return uuidv5(idempotencyKey, CLIENT_MESSAGE_NAMESPACE);
}

export function reminderText(date: IsoDate): string {
  return `Standup reminder for ${date}: please share what you completed, what you are doing today, and any blockers.`;
}

export function deliveryFromExistingClaim(
  memberId: string,
  status: 'pending' | 'sent' | 'unavailable' | 'failed',
): NudgeDelivery {
  if (status === 'sent') return { memberId, status: 'sent' };
  if (status === 'unavailable') {
    return {
      memberId,
      status: 'unavailable',
      message: 'A reminder is unavailable for this member.',
    };
  }
  return {
    memberId,
    status: 'failed',
    message:
      status === 'pending'
        ? 'Reminder delivery is already in progress.'
        : 'A previous reminder delivery failed.',
  };
}

export function unavailableResponse(
  memberIds: string[],
  now: Date,
): NudgeResponse {
  return {
    deliveries: memberIds.map((memberId) => ({
      memberId,
      status: 'unavailable',
      message: 'Proactive Slack delivery is unavailable.',
    })),
    completedAt: now.toISOString(),
  };
}
