import { MissingStandupsViewModel } from '@standup-pulse/shared-contracts';
import { missingStandupsSurface } from './fixed-surfaces';

describe('fixed A2UI surfaces', () => {
  it('pins the schema while keeping member data in the data model', () => {
    const model: MissingStandupsViewModel = {
      team: { id: 'team-1', name: 'Product Team', timeZone: 'Europe/Vienna' },
      date: '2026-08-06',
      members: [{ memberId: 'm-1', displayName: 'Maya Chen' }],
    };

    const operations = missingStandupsSurface(model);
    expect(operations).toHaveLength(3);
    expect(operations[0]).toMatchObject({
      version: 'v0.9',
      createSurface: { surfaceId: 'missing-standups-2026-08-06' },
    });
    expect(JSON.stringify(operations[1])).not.toContain('Maya Chen');
    expect(JSON.stringify(operations[2])).toContain('Maya Chen');
  });
});
