import { IsoDateSchema, type IsoDate } from '@standup-pulse/shared-contracts';
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
  const parts = new Map(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  const year = requireDateTimePart(parts, 'year');
  const month = requireDateTimePart(parts, 'month');
  const day = requireDateTimePart(parts, 'day');

  return {
    date: IsoDateSchema.parse(`${year}-${month}-${day}`),
    hour: Number(requireDateTimePart(parts, 'hour')),
    minute: Number(requireDateTimePart(parts, 'minute')),
  };
}

function requireDateTimePart(parts: ReadonlyMap<string, string>, key: string) {
  const value = parts.get(key);
  if (value === undefined) {
    throw new StandupDomainError(
      'INVALID_TIME_ZONE',
      `Date formatter omitted the ${key} field`,
    );
  }
  return value;
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
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return IsoDateSchema.parse(date.toISOString().slice(0, 10));
}

export function differenceInDays(later: Date, earlier: Date): number {
  return Math.max(
    0,
    Math.floor((later.getTime() - earlier.getTime()) / 86_400_000),
  );
}
