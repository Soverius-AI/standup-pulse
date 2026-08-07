import { TestBed } from '@angular/core/testing';
import {
  IsoDateSchema,
  NudgeResponse,
  RosterResponse,
  StatusResponse,
  TeamPulseViewModel,
} from '@standup-pulse/shared-contracts';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PulseApiClient } from './pulse-api.client';
import { PULSE_STATUS_REFRESH_INTERVAL_MS, PulseStore } from './pulse.store';

const SELECTED_DATE = IsoDateSchema.parse('2026-08-06');
const NEXT_DATE = IsoDateSchema.parse('2026-08-07');

const pulse: TeamPulseViewModel = {
  team: { id: 'team-1', name: 'Product Team', timeZone: 'Europe/Vienna' },
  date: SELECTED_DATE,
  generatedAt: '2026-08-06T09:00:00+02:00',
  totals: {
    roster: 3,
    posted: 1,
    missing: 1,
    blocked: 1,
    participationPct: 67,
  },
  deltas: { posted: 1, missing: -1, blocked: 1, participationPoints: 5 },
  standups: [
    { memberId: 'posted', displayName: 'Alex Kim', status: 'posted' },
    {
      memberId: 'blocked',
      displayName: 'Sara Lind',
      status: 'blocked',
      blockerId: 'b-1',
    },
    { memberId: 'missing', displayName: 'Maya Chen', status: 'missing' },
  ],
  trend: [{ date: SELECTED_DATE, participationPct: 67 }],
  blockers: [
    {
      id: 'b-1',
      title: 'Waiting for credentials',
      owner: { memberId: 'blocked', displayName: 'Sara Lind' },
      ageDays: 2,
    },
  ],
};

const roster: RosterResponse = {
  team: pulse.team,
  members: [
    {
      id: 'posted',
      displayName: 'Alex Kim',
      email: 'alex@example.com',
      slackLinked: true,
      active: true,
    },
    {
      id: 'blocked',
      displayName: 'Sara Lind',
      slackLinked: true,
      active: true,
    },
    {
      id: 'missing',
      displayName: 'Maya Chen',
      slackLinked: false,
      active: true,
    },
  ],
};

const services: StatusResponse = {
  service: { state: 'online' },
  database: { state: 'online' },
  model: { state: 'online', modelId: 'Gemma 4 26B' },
  agent: { state: 'online' },
  channel: { state: 'online', name: 'Standup Pulse' },
  scheduler: { state: 'online', timeZone: 'Europe/Vienna' },
  capabilities: { proactiveNudges: false },
};

describe('PulseStore', () => {
  it('refreshes runtime capabilities independently and recovers after reconnect', () => {
    vi.useFakeTimers();
    const disconnectedServices: StatusResponse = {
      ...services,
      agent: { state: 'degraded' },
      channel: { state: 'offline', name: 'Standup Pulse' },
      capabilities: { proactiveNudges: false },
    };
    const reconnectedServices: StatusResponse = {
      ...services,
      capabilities: { proactiveNudges: true },
    };
    const api = {
      getTeamPulse: vi.fn(() => of(pulse)),
      getRoster: vi.fn(() => of(roster)),
      getStatus: vi
        .fn()
        .mockReturnValueOnce(of(disconnectedServices))
        .mockReturnValue(of(reconnectedServices)),
      nudge: vi.fn(),
    };

    try {
      TestBed.configureTestingModule({
        providers: [{ provide: PulseApiClient, useValue: api }],
      });
      const store = TestBed.inject(PulseStore);

      expect(store.services()).toEqual(disconnectedServices);
      expect(store.canNudge()).toBe(false);

      vi.advanceTimersByTime(PULSE_STATUS_REFRESH_INTERVAL_MS);

      expect(store.services()).toEqual(reconnectedServices);
      expect(store.canNudge()).toBe(true);
      expect(api.getStatus).toHaveBeenCalledTimes(2);
    } finally {
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });

  it('loads one atomic snapshot and orders exceptions before posted updates', () => {
    const api = {
      getTeamPulse: vi.fn(() => of(pulse)),
      getRoster: vi.fn(() => of(roster)),
      getStatus: vi.fn(() => of(services)),
      nudge: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: PulseApiClient, useValue: api }],
    });
    const store = TestBed.inject(PulseStore);

    store.loadForDate(SELECTED_DATE);

    expect(store.loadStatus()).toBe('loaded');
    expect(store.orderedStandups().map(({ status }) => status)).toEqual([
      'missing',
      'blocked',
      'posted',
    ]);
    expect(store.canNudge()).toBe(false);
    expect(api.getTeamPulse).toHaveBeenCalledWith('2026-08-06');
  });

  it('keeps the nudge action disabled when the runtime cannot prove delivery', () => {
    const api = {
      getTeamPulse: vi.fn(() => of(pulse)),
      getRoster: vi.fn(() => of(roster)),
      getStatus: vi.fn(() => of(services)),
      nudge: vi.fn(() => of({} as NudgeResponse)),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: PulseApiClient, useValue: api }],
    });
    const store = TestBed.inject(PulseStore);
    store.loadForDate(SELECTED_DATE);

    store.nudgeMembers(['missing']);

    expect(api.nudge).not.toHaveBeenCalled();
  });

  it('does not enter a pending nudge state before a date is selected', () => {
    const api = {
      getTeamPulse: vi.fn(() => of(pulse)),
      getRoster: vi.fn(() => of(roster)),
      getStatus: vi.fn(() =>
        of({
          ...services,
          capabilities: { proactiveNudges: true },
        }),
      ),
      nudge: vi.fn(() => of({} as NudgeResponse)),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: PulseApiClient, useValue: api }],
    });
    const store = TestBed.inject(PulseStore);

    store.nudgeMembers(['missing']);

    expect(api.nudge).not.toHaveBeenCalled();
    expect(store.isNudging()).toBe(false);
  });

  it('only exposes missing members with linked Slack identities for nudging', () => {
    const linkedRoster: RosterResponse = {
      ...roster,
      members: roster.members.map((member) =>
        member.id === 'missing' ? { ...member, slackLinked: true } : member,
      ),
    };
    const api = {
      getTeamPulse: vi.fn(() => of(pulse)),
      getRoster: vi.fn(() => of(linkedRoster)),
      getStatus: vi.fn(() =>
        of({
          ...services,
          capabilities: { proactiveNudges: true },
        }),
      ),
      nudge: vi.fn(() =>
        of({
          deliveries: [{ memberId: 'missing', status: 'sent' as const }],
          completedAt: '2026-08-06T09:01:00+02:00',
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: PulseApiClient, useValue: api }],
    });
    const store = TestBed.inject(PulseStore);
    store.loadForDate(SELECTED_DATE);

    expect(store.nudgeableMissingMemberIds()).toEqual(['missing']);
    store.nudgeMembers(store.nudgeableMissingMemberIds());
    expect(api.nudge).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-08-06',
        memberIds: ['missing'],
        requestId: expect.any(String),
      }),
    );
  });

  it('surfaces a useful nudge failure and clears the sending state', () => {
    const api = {
      getTeamPulse: vi.fn(() => of(pulse)),
      getRoster: vi.fn(() =>
        of({
          ...roster,
          members: roster.members.map((member) =>
            member.id === 'missing' ? { ...member, slackLinked: true } : member,
          ),
        }),
      ),
      getStatus: vi.fn(() =>
        of({
          ...services,
          capabilities: { proactiveNudges: true },
        }),
      ),
      nudge: vi.fn(() => throwError(() => new Error('Connection refused'))),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: PulseApiClient, useValue: api }],
    });
    const store = TestBed.inject(PulseStore);
    store.loadForDate(SELECTED_DATE);

    store.nudgeMembers(['missing']);

    expect(store.isNudging()).toBe(false);
    expect(store.nudgeError()).toBe(
      'Slack reminder could not be sent. Check the API and Slack connection.',
    );
  });

  it('retains a useful error state when the pulse request fails', () => {
    const api = {
      getTeamPulse: vi.fn(() =>
        throwError(() => new Error('Backend unavailable')),
      ),
      getRoster: vi.fn(() => of(roster)),
      getStatus: vi.fn(() => of(services)),
      nudge: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: PulseApiClient, useValue: api }],
    });
    const store = TestBed.inject(PulseStore);

    store.loadForDate(SELECTED_DATE);

    expect(store.loadStatus()).toBe('error');
    expect(store.loadError()).toContain('Backend unavailable');
  });

  it('clears the prior snapshot when loading a different date fails', () => {
    const api = {
      getTeamPulse: vi
        .fn()
        .mockReturnValueOnce(of(pulse))
        .mockReturnValueOnce(
          throwError(() => new Error('Backend unavailable')),
        ),
      getRoster: vi.fn(() => of(roster)),
      getStatus: vi.fn(() => of(services)),
      nudge: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: PulseApiClient, useValue: api }],
    });
    const store = TestBed.inject(PulseStore);

    store.loadForDate(SELECTED_DATE);
    expect(store.pulse()).toEqual(pulse);
    expect(store.roster()).toEqual(roster);

    store.loadForDate(NEXT_DATE);

    expect(store.selectedDate()).toBe(NEXT_DATE);
    expect(store.loadStatus()).toBe('error');
    expect(store.pulse()).toBeNull();
    expect(store.roster()).toBeNull();
  });
});
