import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStoreFeature,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  IsoDate,
  RosterResponse,
  TeamPulseViewModel,
} from '@standup-pulse/shared-contracts';
import { filter, forkJoin, pipe, switchMap, tap } from 'rxjs';
import { readableError } from '../../util/readable-error';
import { PulseApiClient } from '../pulse-api.client';

export type PulseLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface PulseSnapshotState {
  selectedDate: IsoDate | null;
  pulse: TeamPulseViewModel | null;
  roster: RosterResponse | null;
  loadStatus: PulseLoadStatus;
  loadError: string | null;
}

const initialState: PulseSnapshotState = {
  selectedDate: null,
  pulse: null,
  roster: null,
  loadStatus: 'idle',
  loadError: null,
};

const statusOrder = { missing: 0, blocked: 1, posted: 2 } as const;

/**
 * Snapshot concern: which day is selected and the pulse + roster loaded for
 * it. Foundation feature of the pulse store — nudging and roster mutations
 * both declare dependencies on the state and methods provided here.
 */
export function withPulseSnapshot() {
  return signalStoreFeature(
    withState(initialState),
    withComputed(({ pulse, roster }) => ({
      orderedStandups: computed(() =>
        [...(pulse()?.standups ?? [])].sort(
          (left, right) => statusOrder[left.status] - statusOrder[right.status],
        ),
      ),
      nudgeableMissingMemberIds: computed(() => {
        const linkedMemberIds = new Set(
          (roster()?.members ?? [])
            .filter(({ active, slackLinked }) => active && slackLinked)
            .map(({ id }) => id),
        );
        return (pulse()?.standups ?? [])
          .filter(
            ({ memberId, status }) =>
              status === 'missing' && linkedMemberIds.has(memberId),
          )
          .map(({ memberId }) => memberId);
      }),
      hasExceptions: computed(() => {
        const totals = pulse()?.totals;
        return Boolean(totals && (totals.missing > 0 || totals.blocked > 0));
      }),
    })),
    withMethods((store, api = inject(PulseApiClient)) => {
      const loadForDate = rxMethod<IsoDate>(
        pipe(
          filter(Boolean),
          tap((selectedDate) =>
            patchState(store, {
              selectedDate,
              pulse: null,
              roster: null,
              loadStatus: 'loading',
              loadError: null,
            }),
          ),
          switchMap((selectedDate) =>
            forkJoin({
              pulse: api.getTeamPulse(selectedDate),
              roster: api.getRoster(),
            }).pipe(
              tapResponse({
                next: ({ pulse, roster }) =>
                  patchState(store, {
                    pulse,
                    roster,
                    loadStatus: 'loaded',
                    loadError: null,
                  }),
                error: (error) =>
                  patchState(store, {
                    loadStatus: 'error',
                    loadError: readableError(error),
                  }),
              }),
            ),
          ),
        ),
      );

      return {
        loadForDate,
        refresh(): void {
          const date = store.selectedDate();
          if (!date) return;
          loadForDate(date);
        },
      };
    }),
  );
}
