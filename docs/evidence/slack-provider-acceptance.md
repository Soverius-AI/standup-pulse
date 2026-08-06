# Slack provider acceptance

Date: 2026-08-06

Workspace: `soveriusai.slack.com`

Test channel: `#standup-bot-testing`

Managed Channel: `standup-pulse`

## Results

- Passed: a human top-level `@standup-pulse` mention received a model-backed reply using stored team data and the trusted work date `2026-08-06`.
- Passed: an unmentioned follow-up in the subscribed Slack thread received a useful blocker answer.
- Passed: an unmentioned new top-level conversation remained silent for the requested observation window.

The provider messages were sent and visually confirmed by the user, as required by the Channels acceptance workflow. No provider secret was copied into this evidence.
