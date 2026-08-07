import { Slack } from '@copilotkit/channels/slack';
import type { TeamPulseViewModel } from '@standup-pulse/shared-contracts';

/** Slack-only visualization posted in addition to the portable pulse card. */
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
