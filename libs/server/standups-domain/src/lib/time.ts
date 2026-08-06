import type { IsoDate } from '@standup-pulse/shared-contracts';
import { StandupDomainError } from './errors';

export interface LocalClockParts {
  date: IsoDate;
  hour: number;
  minute: number;
}

export function assertIanaTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
  } catch {
    throw new StandupDomainError(
      'INVALID_TIME_ZONE',
      `Invalid IANA time zone: ${timeZone}`,
    );
  }
}

export function getLocalClockParts(
  now: Date,
  timeZone: string,
): LocalClockParts {
  assertIanaTimeZone(timeZone);

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts['year']}-${parts['month']}-${parts['day']}` as IsoDate,
    hour: Number(parts['hour']),
    minute: Number(parts['minute']),
  };
}

export function getLocalDate(now: Date, timeZone: string): IsoDate {
  return getLocalClockParts(now, timeZone).date;
}

export function parseLocalTime(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid local time: ${value}`);

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid local time: ${value}`);

  return hour * 60 + minute;
}

export function shiftIsoDate(value: IsoDate, days: number): IsoDate {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10) as IsoDate;
}

export function differenceInDays(later: Date, earlier: Date): number {
  return Math.max(
    0,
    Math.floor((later.getTime() - earlier.getTime()) / 86_400_000),
  );
}
