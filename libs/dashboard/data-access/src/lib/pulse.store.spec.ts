import { TestBed } from '@angular/core/testing';
import {
  NudgeResponse,
  RosterResponse,
  StatusResponse,
  TeamPulseViewModel,
} from '@standup-pulse/shared-contracts';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PulseApiClient } from './pulse-api.client';
import { PulseStore } from './pulse.store';

const pulse: TeamPulseViewModel = {
  team: { id: 'team-1', name: 'Product Team', timeZone: 'Europe/Vienna' },
  date: '2026-08-06',
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
  trend: [{ date: '2026-08-06', participationPct: 67 }],
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

    store.loadForDate('2026-08-06');

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
    store.loadForDate('2026-08-06');

    store.nudgeMembers(['missing']);

    expect(api.nudge).not.toHaveBeenCalled();
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
    store.loadForDate('2026-08-06');

    expect(store.nudgeableMissingMemberIds()).toEqual(['missing']);
    store.nudgeMembers(store.nudgeableMissingMemberIds());
    expect(api.nudge).toHaveBeenCalledWith({
      date: '2026-08-06',
      memberIds: ['missing'],
    });
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
    store.loadForDate('2026-08-06');

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

    store.loadForDate('2026-08-06');

    expect(store.loadStatus()).toBe('error');
    expect(store.loadError()).toContain('Backend unavailable');
  });
});
