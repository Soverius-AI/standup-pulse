import type {
  BlockerDigestViewModel,
  MissingStandupsViewModel,
  StandupReceiptViewModel,
} from './contracts';

export type FixedA2UIOperation = Record<string, unknown>;

export const BASIC_A2UI_CATALOG_ID =
  'https://a2ui.org/specification/v0_9/basic_catalog.json';

function createSurface(surfaceId: string): FixedA2UIOperation {
  return {
    version: 'v0.9',
    createSurface: { surfaceId, catalogId: BASIC_A2UI_CATALOG_ID },
  };
}

function updateComponents(
  surfaceId: string,
  components: readonly Record<string, unknown>[],
): FixedA2UIOperation {
  return { version: 'v0.9', updateComponents: { surfaceId, components } };
}

function updateDataModel(
  surfaceId: string,
  value: Record<string, unknown>,
): FixedA2UIOperation {
  return { version: 'v0.9', updateDataModel: { surfaceId, value } };
}

export function missingStandupsSurface(
  model: MissingStandupsViewModel,
): readonly FixedA2UIOperation[] {
  const surfaceId = `missing-standups-${model.date}`;
  return [
    createSurface(surfaceId),
    updateComponents(surfaceId, [
      { id: 'root', component: 'Card', child: 'content' },
      {
        id: 'content',
        component: 'Column',
        children: ['title', 'summary', 'members'],
      },
      {
        id: 'title',
        component: 'Text',
        text: 'Missing standups',
        variant: 'h3',
      },
      { id: 'summary', component: 'Text', text: { path: '/summary' } },
      {
        id: 'members',
        component: 'List',
        children: { componentId: 'member', path: '/members' },
        direction: 'vertical',
        listStyle: 'none',
      },
      { id: 'member', component: 'Text', text: { path: '/displayName' } },
    ]),
    updateDataModel(surfaceId, {
      summary: `${model.members.length} ${model.members.length === 1 ? 'person has' : 'people have'} not posted for ${model.date}.`,
      members: model.members,
    }),
  ];
}

export function blockerDigestSurface(
  model: BlockerDigestViewModel,
): readonly FixedA2UIOperation[] {
  const surfaceId = `blocker-digest-${model.date}`;
  return [
    createSurface(surfaceId),
    updateComponents(surfaceId, [
      { id: 'root', component: 'Card', child: 'content' },
      {
        id: 'content',
        component: 'Column',
        children: ['title', 'summary', 'blockers'],
      },
      {
        id: 'title',
        component: 'Text',
        text: 'Blockers needing attention',
        variant: 'h3',
      },
      { id: 'summary', component: 'Text', text: { path: '/summary' } },
      {
        id: 'blockers',
        component: 'List',
        children: { componentId: 'blocker', path: '/blockers' },
        direction: 'vertical',
        listStyle: 'none',
      },
      { id: 'blocker', component: 'Text', text: { path: '/label' } },
    ]),
    updateDataModel(surfaceId, {
      summary: `${model.blockers.length} active ${model.blockers.length === 1 ? 'blocker' : 'blockers'}.`,
      blockers: model.blockers.map((blocker) => ({
        label: `${blocker.title} — ${blocker.owner.displayName}, ${blocker.ageDays}d`,
      })),
    }),
  ];
}

export function standupReceiptSurface(
  model: StandupReceiptViewModel,
): readonly FixedA2UIOperation[] {
  const surfaceId = `standup-receipt-${model.member.memberId}-${model.date}`;
  return [
    createSurface(surfaceId),
    updateComponents(surfaceId, [
      { id: 'root', component: 'Card', child: 'content' },
      {
        id: 'content',
        component: 'Column',
        children: ['title', 'member', 'status', 'blockers'],
      },
      {
        id: 'title',
        component: 'Text',
        text: 'Standup recorded',
        variant: 'h3',
      },
      { id: 'member', component: 'Text', text: { path: '/member' } },
      { id: 'status', component: 'Text', text: { path: '/status' } },
      { id: 'blockers', component: 'Text', text: { path: '/blockers' } },
    ]),
    updateDataModel(surfaceId, {
      member: model.member.displayName,
      status: model.updated
        ? 'Today’s update was replaced.'
        : 'Today’s update was saved.',
      blockers: `${model.blockerCount} ${model.blockerCount === 1 ? 'blocker' : 'blockers'} reported.`,
    }),
  ];
}
