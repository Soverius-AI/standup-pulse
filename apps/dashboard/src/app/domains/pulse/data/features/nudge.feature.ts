import { Signal, computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStoreFeature,
  type,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { IsoDate, NudgeResponse } from '@standup-pulse/shared-contracts';
import { exhaustMap, filter, map, pipe, tap } from 'rxjs';
import { PulseApiClient } from '../pulse-api.client';

interface NudgeState {
  pendingNudgeMemberIds: string[];
  lastNudgeResult: NudgeResponse | null;
  nudgeError: string | null;
}

const initialState: NudgeState = {
  pendingNudgeMemberIds: [],
  lastNudgeResult: null,
  nudgeError: null,
};

/**
 * Nudging concern: fires Slack reminders for missing standups and tracks the
 * delivery outcome.
 *
 * The `type<...>()` input constraint declares what earlier features must
 * provide: `selectedDate` state from `withPulseSnapshot` and the `canNudge`
 * computed from `withServiceStatus` (computeds land in `props`). The
 * constraint is enforced by the compiler at the `signalStore(...)`
 * composition site.
 */
export function withNudging() {
  return signalStoreFeature(
    type<{
      state: { selectedDate: IsoDate | null };
      props: { canNudge: Signal<boolean> };
    }>(),
    withState(initialState),
    withComputed(({ pendingNudgeMemberIds, lastNudgeResult }) => ({
      isNudging: computed(() => pendingNudgeMemberIds().length > 0),
      nudgeSummary: computed(() => {
        const deliveries = lastNudgeResult()?.deliveries ?? [];
        return deliveries.reduce(
          (summary, delivery) => ({
            ...summary,
            [delivery.status]: summary[delivery.status] + 1,
          }),
          { sent: 0, unavailable: 0, failed: 0 },
        );
      }),
    })),
    withMethods((store, api = inject(PulseApiClient)) => ({
      nudgeMembers: rxMethod<string[]>(
        pipe(
          filter((memberIds) => memberIds.length > 0),
          map((memberIds) => ({
            memberIds,
            date: store.selectedDate(),
          })),
          filter(
            (request): request is { memberIds: string[]; date: IsoDate } =>
              request.date !== null,
          ),
          filter(() => store.canNudge() && !store.isNudging()),
          tap(({ memberIds }) =>
            patchState(store, {
              pendingNudgeMemberIds: memberIds,
              lastNudgeResult: null,
              nudgeError: null,
            }),
          ),
          exhaustMap(({ memberIds, date }) =>
            api
              .nudge({
                date,
                memberIds,
                requestId: globalThis.crypto.randomUUID(),
              })
              .pipe(
                tapResponse({
                  next: (lastNudgeResult) =>
                    patchState(store, { lastNudgeResult, nudgeError: null }),
                  error: () =>
                    patchState(store, {
                      nudgeError:
                        'Slack reminder could not be sent. Check the API and Slack connection.',
                    }),
                  finalize: () =>
                    patchState(store, { pendingNudgeMemberIds: [] }),
                }),
              ),
          ),
        ),
      ),
      clearNudgeResult(): void {
        patchState(store, { lastNudgeResult: null, nudgeError: null });
      },
    })),
  );
}
