import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CopilotChat, provideCopilotKit } from '@copilotkit/angular';
import { PulseApiClient } from './domains/pulse/data/pulse-api.client';
import { PulseStore } from './domains/pulse/data/pulse.store';
import {
  IsoDateSchema,
  StatusResponse,
  TeamPulseViewModel,
} from '@standup-pulse/shared-contracts';
import { of } from 'rxjs';

const emptyPulse: TeamPulseViewModel = {
  team: { id: 'team-1', name: 'Product Team', timeZone: 'Europe/Vienna' },
  date: IsoDateSchema.parse('2026-08-06'),
  generatedAt: '2026-08-06T09:00:00+02:00',
  totals: { roster: 0, posted: 0, missing: 0, blocked: 0, participationPct: 0 },
  deltas: { posted: 0, missing: 0, blocked: 0, participationPoints: 0 },
  standups: [],
  trend: [],
  blockers: [],
};

const services: StatusResponse = {
  service: { state: 'online' },
  database: { state: 'online' },
  model: { state: 'online', modelId: 'Gemma 4 26B' },
  agent: { state: 'online' },
  channel: { state: 'degraded' },
  scheduler: { state: 'online', timeZone: 'Europe/Vienna' },
  capabilities: { proactiveNudges: false },
};

@Component({
  imports: [CopilotChat],
  template: `
    <output data-testid="signal-store-status">{{ store.loadStatus() }}</output>
    <copilot-chat />
  `,
})
class Angular22CompatibilityHost {
  readonly store = inject(PulseStore);
}

describe('Angular 22 compatibility', () => {
  it('renders CopilotKit beside an NgRx RC SignalStore without ZoneJS', async () => {
    const api = {
      getTeamPulse: () => of(emptyPulse),
      getRoster: () => of({ team: emptyPulse.team, members: [] }),
      getStatus: () => of(services),
      nudge: () =>
        of({ deliveries: [], completedAt: '2026-08-06T09:01:00+02:00' }),
    };
    await TestBed.configureTestingModule({
      imports: [Angular22CompatibilityHost],
      providers: [
        { provide: PulseApiClient, useValue: api },
        provideCopilotKit({ runtimeUrl: '/api/copilotkit' }),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Angular22CompatibilityHost);
    fixture.componentInstance.store.loadForDate(
      IsoDateSchema.parse('2026-08-06'),
    );
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector('[data-testid="signal-store-status"]')?.textContent,
    ).toBe('loaded');
    expect(host.querySelector('copilot-chat')).toBeTruthy();
  });
});
