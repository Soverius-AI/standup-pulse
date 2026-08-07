import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStoreFeature,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { StatusResponse } from '@standup-pulse/shared-contracts';
import {
  catchError,
  concat,
  EMPTY,
  exhaustMap,
  of,
  pipe,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { PulseApiClient } from '../pulse-api.client';

export const PULSE_STATUS_REFRESH_INTERVAL_MS = 10_000;

interface ServiceStatusState {
  services: StatusResponse | null;
}

const initialState: ServiceStatusState = {
  services: null,
};

/**
 * Runtime-status concern: polls `/api/status` every 10 seconds and derives
 * whether proactive Slack nudges are available.
 *
 * Self-contained feature — it declares no dependencies on other features and
 * starts its own polling loop via `withHooks`, so the composed store needs no
 * lifecycle wiring for it.
 */
export function withServiceStatus() {
  return signalStoreFeature(
    withState(initialState),
    withComputed(({ services }) => ({
      canNudge: computed(
        () => services()?.capabilities.proactiveNudges === true,
      ),
    })),
    withMethods((store, api = inject(PulseApiClient)) => ({
      monitorServices: rxMethod<void>(
        pipe(
          switchMap(() =>
            concat(
              of(0),
              timer(
                PULSE_STATUS_REFRESH_INTERVAL_MS,
                PULSE_STATUS_REFRESH_INTERVAL_MS,
              ),
            ).pipe(
              exhaustMap(() =>
                api.getStatus().pipe(
                  tap((services) => patchState(store, { services })),
                  catchError(() => {
                    patchState(store, { services: null });
                    return EMPTY;
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
    })),
    withHooks({
      onInit(store) {
        store.monitorServices();
      },
    }),
  );
}
