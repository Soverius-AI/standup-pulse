import {
  Context,
  Field,
  Fields,
  Header,
  Message,
  Section,
} from '@copilotkit/channels';
import { Slack } from '@copilotkit/channels/slack';
import type {
  BlockerDigestViewModel,
  StandupReceiptViewModel,
  TeamPulseViewModel,
} from '@standup-pulse/shared-contracts';

const pct = (value: number) => `${Math.round(value)}%`;

export function TeamPulseCard({ pulse }: { pulse: TeamPulseViewModel }) {
  return (
    <Message accent="#4F46E5">
      <Header>{`📊 ${pulse.team.name} · ${pulse.date}`}</Header>
      <Fields>
        <Field>{`**Posted**\n${pulse.totals.posted}/${pulse.totals.roster}`}</Field>
        <Field>{`**Participation**\n${pct(pulse.totals.participationPct)}`}</Field>
        <Field>{`**Missing**\n${pulse.totals.missing}`}</Field>
        <Field>{`**Blocked**\n${pulse.totals.blocked}`}</Field>
      </Fields>
      <Context>{`Generated ${new Date(pulse.generatedAt).toLocaleString(
        'en-GB',
        {
          timeZone: pulse.team.timeZone,
        },
      )} · ${pulse.team.timeZone}`}</Context>
    </Message>
  );
}

export function TeamPulseChart({ pulse }: { pulse: TeamPulseViewModel }) {
  const categories = pulse.trend.map(({ date }) => date.slice(5));

  return (
    <Slack.Block.DataVisualization
      title="Standup participation"
      chart={{
        type: 'bar',
        series: [
          {
            name: 'Participation',
            data: pulse.trend.map(({ date, participationPct }) => ({
              label: date.slice(5),
              value: participationPct,
            })),
          },
        ],
        axis_config: {
          categories,
          x_label: 'Work date',
          y_label: 'Participation %',
        },
      }}
    />
  );
}

export function BlockerDigestCard({
  digest,
}: {
  digest: BlockerDigestViewModel;
}) {
  return (
    <Message accent={digest.blockers.length ? '#DC2626' : '#16A34A'}>
      <Header>{`🚧 Blockers · ${digest.date}`}</Header>
      {digest.blockers.length ? (
        digest.blockers.map((blocker) => (
          <Section>{`**${blocker.owner.displayName}** · ${blocker.title}\nOpen ${blocker.ageDays} day${blocker.ageDays === 1 ? '' : 's'}`}</Section>
        ))
      ) : (
        <Section>No open blockers for this work date.</Section>
      )}
      <Context>{`${digest.team.name} · ${digest.team.timeZone}`}</Context>
    </Message>
  );
}

export function StandupReceiptCard({
  receipt,
}: {
  receipt: StandupReceiptViewModel;
}) {
  return (
    <Message accent="#16A34A">
      <Header>
        {receipt.updated ? '✅ Standup updated' : '✅ Standup recorded'}
      </Header>
      <Fields>
        <Field>{`**Member**\n${receipt.member.displayName}`}</Field>
        <Field>{`**Work date**\n${receipt.date}`}</Field>
        <Field>{`**Blockers captured**\n${receipt.blockerCount}`}</Field>
      </Fields>
      <Context>{`${receipt.team.name} · ${receipt.team.timeZone}`}</Context>
    </Message>
  );
}
