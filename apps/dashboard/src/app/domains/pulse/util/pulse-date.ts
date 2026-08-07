import { IsoDateSchema, type IsoDate } from '@standup-pulse/shared-contracts';

export const DEFAULT_PULSE_TIME_ZONE = 'Europe/Vienna';

export function todayIn(timeZone: string): IsoDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? '';
  return IsoDateSchema.parse(`${part('year')}-${part('month')}-${part('day')}`);
}
