import { z } from 'zod';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isIsoCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const IsoDateSchema = z
  .string()
  .refine(isIsoCalendarDate, 'Expected a valid ISO calendar date (YYYY-MM-DD)');

export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const TeamSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    timeZone: z.string().min(1),
  })
  .strict();

export const StandupStatusSchema = z.enum(['posted', 'missing', 'blocked']);

export const TeamPulseStandupSchema = z
  .object({
    memberId: z.string().min(1),
    displayName: z.string().min(1),
    avatarUrl: z.string().url().optional(),
    status: StandupStatusSchema,
    preview: z.string().optional(),
    blockerId: z.string().min(1).optional(),
  })
  .strict();

export const BlockerOwnerSchema = z
  .object({
    memberId: z.string().min(1),
    displayName: z.string().min(1),
    avatarUrl: z.string().url().optional(),
  })
  .strict();

export const TeamPulseBlockerSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    owner: BlockerOwnerSchema,
    ageDays: z.number().int().nonnegative(),
  })
  .strict();

export const TeamPulseViewModelSchema = z
  .object({
    team: TeamSummarySchema,
    date: IsoDateSchema,
    generatedAt: IsoDateTimeSchema,
    totals: z
      .object({
        roster: z.number().int().nonnegative(),
        posted: z.number().int().nonnegative(),
        missing: z.number().int().nonnegative(),
        blocked: z.number().int().nonnegative(),
        participationPct: z.number().min(0).max(100),
      })
      .strict(),
    deltas: z
      .object({
        posted: z.number().int(),
        missing: z.number().int(),
        blocked: z.number().int(),
        participationPoints: z.number(),
      })
      .strict(),
    standups: z.array(TeamPulseStandupSchema),
    trend: z.array(
      z
        .object({
          date: IsoDateSchema,
          participationPct: z.number().min(0).max(100),
        })
        .strict(),
    ),
    blockers: z.array(TeamPulseBlockerSchema),
  })
  .strict();

export const MissingStandupsViewModelSchema = z
  .object({
    team: TeamSummarySchema,
    date: IsoDateSchema,
    members: z.array(
      z
        .object({
          memberId: z.string().min(1),
          displayName: z.string().min(1),
          avatarUrl: z.string().url().optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const BlockerDigestViewModelSchema = z
  .object({
    team: TeamSummarySchema,
    date: IsoDateSchema,
    blockers: z.array(TeamPulseBlockerSchema),
  })
  .strict();

export const StandupReceiptViewModelSchema = z
  .object({
    team: TeamSummarySchema,
    date: IsoDateSchema,
    member: z
      .object({
        memberId: z.string().min(1),
        displayName: z.string().min(1),
        avatarUrl: z.string().url().optional(),
      })
      .strict(),
    submittedAt: IsoDateTimeSchema,
    blockerCount: z.number().int().nonnegative(),
    updated: z.boolean(),
  })
  .strict();

/**
 * Deliberately contains no identity fields. Identity is supplied by trusted
 * server transport context, never by the model or browser payload.
 */
export const SubmitStandupInputSchema = z
  .object({
    yesterday: z.string().trim().min(1).max(4_000),
    today: z.string().trim().min(1).max(4_000),
    blockers: z.array(z.string().trim().min(1).max(1_000)).max(20).default([]),
  })
  .strict();

export const RosterMemberSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    email: z.string().email().optional(),
    avatarUrl: z.string().url().optional(),
    slackLinked: z.boolean(),
    active: z.boolean(),
  })
  .strict();

export const RosterResponseSchema = z
  .object({
    team: TeamSummarySchema,
    members: z.array(RosterMemberSchema),
  })
  .strict();

export const CreateRosterMemberRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(200),
    email: z.string().trim().email().optional(),
    avatarUrl: z.string().url().optional(),
    slackUserId: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const UpdateRosterMemberRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().email().nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
    slackUserId: z.string().trim().min(1).max(100).nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field is required',
  );

export const NudgeRequestSchema = z
  .object({
    date: IsoDateSchema,
    memberIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const NudgeDeliverySchema = z
  .object({
    memberId: z.string().min(1),
    status: z.enum(['sent', 'unavailable', 'failed']),
    message: z.string().optional(),
  })
  .strict();

export const NudgeResponseSchema = z
  .object({
    deliveries: z.array(NudgeDeliverySchema),
    completedAt: IsoDateTimeSchema,
  })
  .strict();

export const RuntimeComponentStateSchema = z
  .object({
    state: z.enum(['online', 'degraded', 'offline']),
    message: z.string().optional(),
  })
  .strict();

export const StatusResponseSchema = z
  .object({
    service: RuntimeComponentStateSchema,
    database: RuntimeComponentStateSchema,
    model: RuntimeComponentStateSchema.extend({
      modelId: z.string().optional(),
    }).strict(),
    agent: RuntimeComponentStateSchema,
    channel: RuntimeComponentStateSchema.extend({
      name: z.string().optional(),
    }).strict(),
    scheduler: RuntimeComponentStateSchema.extend({
      timeZone: z.string(),
      lastRunAt: IsoDateTimeSchema.optional(),
      nextRunAt: IsoDateTimeSchema.optional(),
    }).strict(),
    capabilities: z
      .object({
        proactiveNudges: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const ErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        details: z.unknown().optional(),
      })
      .strict(),
  })
  .strict();

export type IsoDate = z.infer<typeof IsoDateSchema>;
export type TeamSummary = z.infer<typeof TeamSummarySchema>;
export type TeamPulseViewModel = z.infer<typeof TeamPulseViewModelSchema>;
export type MissingStandupsViewModel = z.infer<
  typeof MissingStandupsViewModelSchema
>;
export type BlockerDigestViewModel = z.infer<
  typeof BlockerDigestViewModelSchema
>;
export type StandupReceiptViewModel = z.infer<
  typeof StandupReceiptViewModelSchema
>;
export type SubmitStandupInput = z.infer<typeof SubmitStandupInputSchema>;
export type RosterMember = z.infer<typeof RosterMemberSchema>;
export type RosterResponse = z.infer<typeof RosterResponseSchema>;
export type CreateRosterMemberRequest = z.infer<
  typeof CreateRosterMemberRequestSchema
>;
export type UpdateRosterMemberRequest = z.infer<
  typeof UpdateRosterMemberRequestSchema
>;
export type NudgeRequest = z.infer<typeof NudgeRequestSchema>;
export type NudgeDelivery = z.infer<typeof NudgeDeliverySchema>;
export type NudgeResponse = z.infer<typeof NudgeResponseSchema>;
export type StatusResponse = z.infer<typeof StatusResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
