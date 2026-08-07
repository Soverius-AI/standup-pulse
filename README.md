# Standup Pulse

Standup Pulse is a local-first async standup agent for Slack with an Angular admin dashboard. It runs an optimized Unsloth Gemma 4 26B A4B MoE GGUF with MTP speculative decoding through llama.cpp, uses Mastra for the agent, CopilotKit Channels for Slack transport, and CopilotKit Angular with model-generated A2UI in the dashboard.

## Stack

- Nx monorepo, pnpm, Node.js
- Angular 22, NgRx SignalStore 22 RC, Tailwind CSS 4, daisyUI 5
- Hono, SQLite, Drizzle ORM
- Mastra, AG-UI, CopilotKit Runtime and Channels
- `unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q4_K_M` with its MTP drafter on llama.cpp

## Run locally

Install dependencies:

```sh
pnpm install
```

Start the local model in one terminal:

```sh
tools/model/start-local-model.sh q4
```

Start the dashboard and its API/Channel dependency in another terminal:

```sh
pnpm nx serve dashboard
```

The dashboard is available at `http://localhost:4200`. The API listens on `http://127.0.0.1:3000`; `/api/status` reports the model, agent, database, scheduler, and managed Channel states.

### Inspect the agent in Mastra Studio

With the model running, start Studio in a third terminal:

```sh
pnpm nx run api:studio
```

Open `http://localhost:4111`, select **Standup Pulse**, then choose the
**Ada · local admin** request-context preset. Studio can run the same local
agent against the same standup database and shows its model calls, tool calls,
inputs, outputs, timings, and trace tree. This local Studio is intentionally a
development surface; do not expose port `4111` publicly without adding Studio
authentication.

Studio and the Hono API write to the same local LibSQL observability domain, so
dashboard, Slack, and Studio-originated runs appear in the same trace view.
Standup text and blocker fields are redacted before persistence. The Editor is a
development authoring surface: changes are not hot-applied to the running API;
promote reviewed changes through the shared agent source and restart the stack.

The selected CopilotKit project environment lives in ignored `.env`. Provider setup credentials are removable after a successful Channel reconcile and must not remain in source control.

## Managed Slack Channel

The tracked declaration is `.copilotkit/channels.json`:

- Channel: `standup-pulse`
- Display name: `Standup Pulse`
- Provider: Slack
- Test channel: `#standup-bot-testing`

Check the managed state with:

```sh
npx --yes copilotkit@4.8.1 channels status --json
```

The runtime subscribes a thread on `@standup-pulse` mention, answers later
unmentioned messages only inside that subscribed thread, and remains silent in
unrelated conversations. CopilotKit Channels routes a mentioned event to the
mention handler instead of also invoking the ordinary message handler, so one
inbound event produces one agent run.

### Channel architecture

The Channel boundary is deliberately split by responsibility:

- `apps/api/src/channels/standup-channel-domain.ts` defines the small application
  port required by model-controlled Channel tools.
- `apps/api/src/channels/channel-handlers.ts` owns mention, subscription, prompt,
  and visible failure behavior.
- `apps/api/src/channels/standup-channels.ts` only validates and composes the
  managed Channel.
- `apps/api/src/channels/standup-tools.tsx` defines the three domain-backed tools:
  submit a standup, render the team pulse, and render the blocker digest.
- `apps/api/src/channels/standup-cards.tsx` contains portable Channel cards;
  `team-pulse-chart.tsx` contains the Slack-only chart.
- `apps/api/src/runtime/channel-runtime.ts` owns Intelligence configuration and
  Channel lifecycle. `standup-channel-domain-adapter.ts` connects the Channel
  port to the standup service and trusted Slack identity resolver.

Identity, source-message references, and the current work date come from trusted
runtime context rather than model arguments. Standup writes accept only a human
Slack actor. Read-only cards remain provider-portable, with the native trend chart
added only on Slack.

## Validation

```sh
pnpm exec prettier --check .
pnpm nx run-many -t lint,test,build --all --skip-nx-cache
pnpm exec tsc -p apps/api/tsconfig.app.json --noEmit
RUN_LOCAL_MODEL_TESTS=1 pnpm nx test api --skip-nx-cache
pnpm nx e2e dashboard-e2e --skip-nx-cache
```

The pinned-artifact and smoke-test procedure is documented in [`docs/model/local-gemma-runbook.md`](docs/model/local-gemma-runbook.md).

## Layout

- `apps/dashboard` — Angular CopilotKit dashboard, organized as a DDD structure inside the app:
  - `src/app/core` — app-wide configuration (CopilotKit setup)
  - `src/app/domains/pulse/feature-*` — routed feature slices (shell, today, team, history, settings)
  - `src/app/domains/pulse/ui` — presentational components (no store access)
  - `src/app/domains/pulse/data` — `PulseApiClient` + SignalStores composed from custom `signalStoreFeature`s
  - `src/app/domains/pulse/util` — pure helpers
- `apps/api` — Hono API, Copilot runtime, and Channel lifecycle host, organized as a DDD structure inside the app:
  - `src/domain` — standup business rules (models, ports, service)
  - `src/data` — SQLite/Drizzle persistence and scheduling
  - `src/agent` — Mastra agent and local-model adapter
  - `src/channels` — Channel contracts, inbound handlers, tool definitions, portable cards, and Slack-specific presentation
  - `src/http` — Hono routes and error handling
  - `src/runtime` — Copilot runtime and Channel integration
  - `src/slack` — proactive nudge delivery
  - `src/config` — environment and channel configuration
  - `src/studio` — local Mastra Studio entry point (`pnpm nx studio api`)
- `libs/shared/contracts` — shared Zod contracts and protocol identifiers
- `tools/model` — llama.cpp startup, smoke-test, and model-manifest tooling
