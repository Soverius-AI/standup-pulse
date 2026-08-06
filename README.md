# Standup Pulse

Standup Pulse is a local-first async standup agent for Slack with an Angular admin dashboard. It runs an optimized Unsloth Gemma 4 26B-A4B GGUF through llama.cpp, uses Mastra for the agent, CopilotKit Channels for Slack transport, and CopilotKit Angular with fixed A2UI surfaces in the dashboard.

## Stack

- Nx monorepo, pnpm, Node.js
- Angular 22, NgRx SignalStore 22 RC, Tailwind CSS 4, daisyUI 5
- Hono, SQLite, Drizzle ORM
- Mastra, AG-UI, CopilotKit Runtime and Channels
- `unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q4_K_M` on llama.cpp

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
pnpm nx serve studio
```

Open `http://localhost:4111`, select **Standup Pulse**, then choose the
**Ada · local admin** request-context preset. Studio can run the same local
agent against the same standup database and shows its model calls, tool calls,
inputs, outputs, timings, and trace tree. This local Studio is intentionally a
development surface; do not expose port `4111` publicly without adding Studio
authentication.

Runs started from Studio are traced in this development process. Dashboard and
Slack traffic still runs through the separate Hono API process; collecting that
traffic in the same trace view requires a shared persistent Mastra observability
store and is intentionally left out of this lightweight local setup.

The selected CopilotKit project environment lives in ignored `.env`. Provider setup credentials are removable after a successful Channel reconcile and must not remain in source control.

## Slack Channel

The tracked declaration is `.copilotkit/channels.json`:

- Channel: `standup-pulse`
- Display name: `Standup Pulse`
- Provider: Slack
- Test channel: `#standup-bot-testing`

Check the managed state with:

```sh
npx --yes copilotkit@4.8.1 channels status --json
```

The runtime subscribes a thread on `@standup-pulse` mention, answers later unmentioned messages only inside that subscribed thread, and remains silent in unrelated conversations.

## Validation

```sh
pnpm exec prettier --check .
pnpm nx run-many -t lint,test,build --all --skip-nx-cache
pnpm exec tsc -p apps/api/tsconfig.app.json --noEmit
pnpm exec tsc -p libs/server/channels/tsconfig.lib.json --noEmit
pnpm exec tsc -p libs/server/agent/tsconfig.lib.json --noEmit
RUN_LOCAL_MODEL_TESTS=1 pnpm nx test standup-agent --skip-nx-cache
pnpm nx e2e dashboard-e2e --skip-nx-cache
```

The larger Q4/Q6 evaluation and promotion procedure is documented in [`docs/model/local-gemma-runbook.md`](docs/model/local-gemma-runbook.md).

## Layout

- `apps/dashboard` — Angular CopilotKit dashboard
- `apps/api` — Hono API, Copilot runtime, and Channel lifecycle host
- `apps/studio` — local Mastra Studio entry point and trusted context presets
- `libs/dashboard` — SignalStore data access, UI, and pulse feature
- `libs/server/agent` — Mastra agent and local-model adapter
- `libs/server/channels` — Slack handlers, trusted-context tools, cards, and chart
- `libs/server/standups-domain` — standup business rules
- `libs/server/standups-data` — SQLite/Drizzle persistence and scheduling
- `libs/shared/contracts` — shared Zod contracts and fixed A2UI surfaces
- `tools/model` — llama.cpp startup, smoke, manifest, and evaluation tools
