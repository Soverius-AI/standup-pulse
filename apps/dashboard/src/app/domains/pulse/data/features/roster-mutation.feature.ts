import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStoreFeature,
  type,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  CreateRosterMemberRequest,
  IsoDate,
  RosterMember,
  RosterResponse,
  UpdateRosterMemberRequest,
} from '@standup-pulse/shared-contracts';
import { exhaustMap, filter, pipe, tap } from 'rxjs';
import { readableError } from '../../util/readable-error';
import { PulseApiClient } from '../pulse-api.client';

export type MemberMutationStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UpdateRosterMemberCommand {
  memberId: string;
  request: UpdateRosterMemberRequest;
}

interface RosterMutationState {
  memberMutationStatus: MemberMutationStatus;
  memberMutationError: string | null;
}

const initialState: RosterMutationState = {
  memberMutationStatus: 'idle',
  memberMutationError: null,
};

/**
 * Roster-mutation concern: creates or updates roster members, patches the
 * saved member into the roster optimistically, then reloads the pulse.
 *
 * Besides state, the `type<...>()` constraint can also require *methods* from
 * earlier features — here `loadForDate` from `withPulseSnapshot` (an
 * `RxMethod<IsoDate>` is assignable to `(date: IsoDate) => void`).
 */
export function withRosterMutations() {
  return signalStoreFeature(
    type<{
      state: {
        selectedDate: IsoDate | null;
        roster: RosterResponse | null;
      };
      methods: { loadForDate: (date: IsoDate) => void };
    }>(),
    withState(initialState),
    withMethods((store, api = inject(PulseApiClient)) => {
      // Closures below stay private — only what the returned object exposes
      // becomes part of the store's public API.
      const replaceRosterMember = (member: RosterMember): void => {
        const roster = store.roster();
        if (!roster) return;
        const exists = roster.members.some(({ id }) => id === member.id);
        patchState(store, {
          roster: {
            ...roster,
            members: exists
              ? roster.members.map((candidate) =>
                  candidate.id === member.id ? member : candidate,
                )
              : [...roster.members, member],
          },
        });
      };

      const refreshAfterRosterMutation = (): void => {
        const date = store.selectedDate();
        if (date) store.loadForDate(date);
      };

      return {
        createRosterMember: rxMethod<CreateRosterMemberRequest>(
          pipe(
            filter(() => store.memberMutationStatus() !== 'saving'),
            tap(() =>
              patchState(store, {
                memberMutationStatus: 'saving',
                memberMutationError: null,
              }),
            ),
            exhaustMap((request) =>
              api.createRosterMember(request).pipe(
                tapResponse({
                  next: (member) => {
                    replaceRosterMember(member);
                    patchState(store, { memberMutationStatus: 'saved' });
                    refreshAfterRosterMutation();
                  },
                  error: (error) =>
                    patchState(store, {
                      memberMutationStatus: 'error',
                      memberMutationError: readableError(error),
                    }),
                }),
              ),
            ),
          ),
        ),
        updateRosterMember: rxMethod<UpdateRosterMemberCommand>(
          pipe(
            filter(() => store.memberMutationStatus() !== 'saving'),
            tap(() =>
              patchState(store, {
                memberMutationStatus: 'saving',
                memberMutationError: null,
              }),
            ),
            exhaustMap(({ memberId, request }) =>
              api.updateRosterMember(memberId, request).pipe(
                tapResponse({
                  next: (member) => {
                    replaceRosterMember(member);
                    patchState(store, { memberMutationStatus: 'saved' });
                    refreshAfterRosterMutation();
                  },
                  error: (error) =>
                    patchState(store, {
                      memberMutationStatus: 'error',
                      memberMutationError: readableError(error),
                    }),
                }),
              ),
            ),
          ),
        ),
        clearMemberMutation(): void {
          patchState(store, {
            memberMutationStatus: 'idle',
            memberMutationError: null,
          });
        },
      };
    }),
  );
}
