import { getLocalClockParts, parseLocalTime, shiftIsoDate } from './time';

describe('team-local time', () => {
  it('distinguishes the repeated Europe/Vienna DST hour by UTC while preserving local time', () => {
    const first = getLocalClockParts(
      new Date('2026-10-25T00:30:00.000Z'),
      'Europe/Vienna',
    );
    const second = getLocalClockParts(
      new Date('2026-10-25T01:30:00.000Z'),
      'Europe/Vienna',
    );

    expect(first).toEqual({ date: '2026-10-25', hour: 2, minute: 30 });
    expect(second).toEqual(first);
  });

  it('observes the first valid minute after the skipped DST hour', () => {
    expect(
      getLocalClockParts(new Date('2026-03-29T01:00:00.000Z'), 'Europe/Vienna'),
    ).toEqual({
      date: '2026-03-29',
      hour: 3,
      minute: 0,
    });
  });

  it('parses local times and shifts calendar dates', () => {
    expect(parseLocalTime('16:30')).toBe(990);
    expect(shiftIsoDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(() => parseLocalTime('25:00')).toThrow();
  });
});
