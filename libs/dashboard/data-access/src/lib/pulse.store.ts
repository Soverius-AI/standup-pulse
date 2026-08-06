import { computed, inject } from '@angular/core';
import {
  CreateRosterMemberRequest,
  NudgeResponse,
  RosterMember,
  RosterResponse,
  StatusResponse,
  TeamPulseViewModel,
  UpdateRosterMemberRequest,
} from '@standup-pulse/shared-contracts';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  exhaustMap,
  filter,
  forkJoin,
  of,
  pipe,
  switchMap,
  tap,
} from 'rxjs';
import { PulseApiClient } from './pulse-api.client';

export type PulseLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type MemberMutationStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UpdateRosterMemberCommand {
  memberId: string;
  request: UpdateRosterMemberRequest;
}

interface PulseState {
  selectedDate: string;
  pulse: TeamPulseViewModel | null;
  roster: RosterResponse | null;
  services: StatusResponse | null;
  loadStatus: PulseLoadStatus;
  loadError: string | null;
  pendingNudgeMemberIds: string[];
  lastNudgeResult: NudgeResponse | null;
  nudgeError: string | null;
  memberMutationStatus: MemberMutationStatus;
  memberMutationError: string | null;
}

const initialState: PulseState = {
  selectedDate: '',
  pulse: null,
  roster: null,
  services: null,
  loadStatus: 'idle',
  loadError: null,
  pendingNudgeMemberIds: [],
  lastNudgeResult: null,
  nudgeError: null,
  memberMutationStatus: 'idle',
  memberMutationError: null,
};

function readableError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The daily pulse could not be loaded. Try again in a moment.';
}

const statusOrder = { missing: 0, blocked: 1, posted: 2 } as const;

export const PulseStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    orderedStandups: computed(() =>
      [...(store.pulse()?.standups ?? [])].sort(
        (left, right) => statusOrder[left.status] - statusOrder[right.status],
      ),
    ),
    missingStandups: computed(() =>
      (store.pulse()?.standups ?? []).filter(
        ({ status }) => status === 'missing',
      ),
    ),
    blockedStandups: computed(() =>
      (store.pulse()?.standups ?? []).filter(
        ({ status }) => status === 'blocked',
      ),
    ),
    activeRosterMembers: computed(() =>
      (store.roster()?.members ?? []).filter(({ active }) => active),
    ),
    nudgeableMissingMemberIds: computed(() => {
      const linkedMemberIds = new Set(
        (store.roster()?.members ?? [])
          .filter(({ active, slackLinked }) => active && slackLinked)
          .map(({ id }) => id),
      );
      return (store.pulse()?.standups ?? [])
        .filter(
          ({ memberId, status }) =>
            status === 'missing' && linkedMemberIds.has(memberId),
        )
        .map(({ memberId }) => memberId);
    }),
    hasExceptions: computed(() => {
      const totals = store.pulse()?.totals;
      return Boolean(totals && (totals.missing > 0 || totals.blocked > 0));
    }),
    canNudge: computed(
      () => store.services()?.capabilities.proactiveNudges === true,
    ),
    isNudging: computed(() => store.pendingNudgeMemberIds().length > 0),
    nudgeSummary: computed(() => {
      const deliveries = store.lastNudgeResult()?.deliveries ?? [];
      return deliveries.reduce(
        (summary, delivery) => ({
          ...summary,
          [delivery.status]: summary[delivery.status] + 1,
        }),
        { sent: 0, unavailable: 0, failed: 0 },
      );
    }),
  })),
  withMethods((store, api = inject(PulseApiClient)) => {
    const loadForDate = rxMethod<string>(
      pipe(
        filter(Boolean),
        tap((selectedDate) =>
          patchState(store, {
            selectedDate,
            loadStatus: 'loading',
            loadError: null,
          }),
        ),
        switchMap((selectedDate) =>
          forkJoin({
            pulse: api.getTeamPulse(selectedDate),
            roster: api.getRoster(),
            services: api.getStatus().pipe(catchError(() => of(null))),
          }).pipe(
            tapResponse({
              next: ({ pulse, roster, services }) =>
                patchState(store, {
                  pulse,
                  roster,
                  services,
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

    const nudgeMembers = rxMethod<string[]>(
      pipe(
        filter((memberIds) => memberIds.length > 0),
        filter(() => store.canNudge() && !store.isNudging()),
        tap((memberIds) =>
          patchState(store, {
            pendingNudgeMemberIds: memberIds,
            lastNudgeResult: null,
            nudgeError: null,
          }),
        ),
        exhaustMap((memberIds) =>
          api.nudge({ date: store.selectedDate(), memberIds }).pipe(
            tapResponse({
              next: (lastNudgeResult) =>
                patchState(store, { lastNudgeResult, nudgeError: null }),
              error: () =>
                patchState(store, {
                  nudgeError:
                    'Slack reminder could not be sent. Check the API and Slack connection.',
                }),
              finalize: () => patchState(store, { pendingNudgeMemberIds: [] }),
            }),
          ),
        ),
      ),
    );

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
      if (date) loadForDate(date);
    };

    const createRosterMember = rxMethod<CreateRosterMemberRequest>(
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
    );

    const updateRosterMember = rxMethod<UpdateRosterMemberCommand>(
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
    );

    return {
      loadForDate,
      nudgeMembers,
      createRosterMember,
      updateRosterMember,
      refresh(): void {
        const date = store.selectedDate();
        if (!date) return;
        loadForDate(date);
      },
      clearNudgeResult(): void {
        patchState(store, { lastNudgeResult: null, nudgeError: null });
      },
      clearMemberMutation(): void {
        patchState(store, {
          memberMutationStatus: 'idle',
          memberMutationError: null,
        });
      },
    };
  }),
);
