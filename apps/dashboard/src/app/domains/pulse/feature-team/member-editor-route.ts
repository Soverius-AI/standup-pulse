import type { Data } from '@angular/router';
import { z } from 'zod';

const MEMBER_MODAL_MODE_KEY = 'memberModalMode';

export const MemberModalModeSchema = z.enum(['create', 'edit']);

export type MemberModalMode = z.infer<typeof MemberModalModeSchema>;

export function memberModalRouteData(mode: MemberModalMode): Data {
  return { [MEMBER_MODAL_MODE_KEY]: mode };
}

export function parseMemberModalMode(data: Data): MemberModalMode {
  return MemberModalModeSchema.parse(data[MEMBER_MODAL_MODE_KEY]);
}
