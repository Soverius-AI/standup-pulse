import { signalStore } from '@ngrx/signals';
import { withNudging } from './features/nudge.feature';
import { withPulseSnapshot } from './features/pulse-snapshot.feature';
import { withRosterMutations } from './features/roster-mutation.feature';
import { withServiceStatus } from './features/service-status.feature';

/**
 * The pulse store is composed from one custom `signalStoreFeature` per
 * concern. Order matters and is compiler-enforced: `withNudging` and
 * `withRosterMutations` declare `type<...>()` input constraints on state,
 * computeds, and methods that the two features above them provide — moving
 * either one up produces a type error right here.
 */
export const PulseStore = signalStore(
  { providedIn: 'root' },
  withServiceStatus(), // services + canNudge; starts its own polling loop
  withPulseSnapshot(), // selectedDate/pulse/roster + loadForDate/refresh
  withNudging(), // requires canNudge (props) + selectedDate (state)
  withRosterMutations(), // requires roster/selectedDate (state) + loadForDate (method)
);

export { PULSE_STATUS_REFRESH_INTERVAL_MS } from './features/service-status.feature';
export type { PulseLoadStatus } from './features/pulse-snapshot.feature';
export type {
  MemberMutationStatus,
  UpdateRosterMemberCommand,
} from './features/roster-mutation.feature';
