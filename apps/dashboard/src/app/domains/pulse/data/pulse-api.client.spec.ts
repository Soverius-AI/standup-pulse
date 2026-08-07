import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { IsoDateSchema } from '@standup-pulse/shared-contracts';
import { PulseApiClient } from './pulse-api.client';

describe('PulseApiClient', () => {
  let api: PulseApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(PulseApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests and validates the selected daily pulse', () => {
    let error: unknown;
    api
      .getTeamPulse(IsoDateSchema.parse('2026-08-06'))
      .subscribe({ error: (value) => (error = value) });

    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/team-pulse' &&
        candidate.params.get('date') === '2026-08-06',
    );
    request.flush({ invalid: true });

    expect(error).toBeTruthy();
  });

  it('creates and updates roster members through the roster API', () => {
    const createdMembers: string[] = [];
    api
      .createRosterMember({
        displayName: 'Ada Lovelace',
        email: 'ada@example.com',
        slackUserId: 'U123',
      })
      .subscribe((member) => createdMembers.push(member.displayName));

    const create = http.expectOne('/api/roster/members');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      slackUserId: 'U123',
    });
    create.flush({
      id: 'ada',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      slackLinked: true,
      active: true,
    });

    api
      .updateRosterMember('ada', { active: false })
      .subscribe((member) => createdMembers.push(member.displayName));
    const update = http.expectOne('/api/roster/members/ada');
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ active: false });
    update.flush({
      id: 'ada',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      slackLinked: true,
      active: false,
    });

    expect(createdMembers).toEqual(['Ada Lovelace', 'Ada Lovelace']);
  });
});
