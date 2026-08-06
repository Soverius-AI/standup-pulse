# Local Gemma 4 inference runbook

The project uses llama.cpp's OpenAI-compatible server with the Unsloth Dynamic GGUF for `gemma-4-26B-A4B-it`.

- Baseline: `unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q4_K_M`
- Promotion candidate: `unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q6_K_XL`
- API aliases: `standup-gemma-4-26b-a4b-q4` and `standup-gemma-4-26b-a4b-q6`
- Context: 131,072 tokens
- Concurrency: one inference slot for the MVP
- Network: loopback only

The [Unsloth model card](https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF) recommends the Q4 tag and Gemma sampling values. llama.cpp requires `--jinja` for OpenAI-style function calling; its [function-calling guide](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md) also warns that aggressive KV-cache quantization can reduce tool reliability.

## First start and model acquisition

The start script does not download anything until it is run. With no explicit model path, llama.cpp fetches and caches the selected Hugging Face artifact:

```sh
tools/model/start-local-model.sh q4
```

For a pinned local artifact, set an explicit path:

```sh
LOCAL_LLM_MODEL_PATH=/absolute/path/to/model.gguf tools/model/start-local-model.sh q4
```

Do not commit GGUF files. After acquisition, capture the exact artifact and runtime:

```sh
node tools/model/manifest.mjs capture \
  --model /absolute/path/to/model.gguf \
  --quant q4 \
  --revision HUGGING_FACE_COMMIT_SHA \
  --output .copilotkit/artifacts/model-manifest-q4.json
```

Before a release-candidate evaluation, verify it again:

```sh
node tools/model/manifest.mjs verify \
  --manifest .copilotkit/artifacts/model-manifest-q4.json \
  --model /absolute/path/to/model.gguf
```

## Health and smoke gate

The API may start while inference is unavailable, but agent readiness must remain degraded until:

1. `/health` returns `{"status":"ok"}`.
2. `/v1/models` contains the configured alias.
3. `/props` reports a 131,072-token context.
4. A native `getTeamPulse` tool-call smoke test passes.

Run the opt-in smoke test against an already-running model:

```sh
RUN_LOCAL_MODEL_TESTS=1 node tools/model/smoke-local.mjs
```

Initial target-Mac budgets are model-ready within 90 seconds after files are local, warm TTFT p95 at or below 2.5 seconds, tool-decision p95 at or below 8 seconds, median generation throughput of at least 20 tokens/second, and no request beyond 30 seconds. These are gates to measure, not claimed results.

## Structured-output strategy

Agent runs use llama.cpp's native OpenAI-style `tools` request with `--jinja`. Mastra validates every tool input again before calling the injected domain service. The provider adapter also normalizes `function.arguments` when a llama.cpp version returns an object instead of the OpenAI-compatible JSON string.

Standalone extraction may use llama.cpp's `response_format: { "type": "json_schema", ... }` support, followed by application-side Zod validation. Do not combine a custom grammar with an OpenAI `tools` request; these are separate request modes. Fixed-schema A2UI operations should be constructed deterministically inside a validated tool rather than generated as unconstrained UI JSON.

## Evaluation gate

The evaluator sends no domain writes. It gives the model tool schemas, records the selected tools and arguments, and validates the result locally. It includes 30 primary cases plus 10 multi-turn cases.

```sh
RUN_LOCAL_MODEL_TESTS=1 \
LOCAL_LLM_EVAL_SEED=42 \
node tools/model/eval-local.mjs
```

Use a different seed for the second clean release-candidate run:

```sh
RUN_LOCAL_MODEL_TESTS=1 \
LOCAL_LLM_EVAL_SEED=31415 \
node tools/model/eval-local.mjs
```

Each release candidate needs two consecutive clean reports. A report passes only when:

- at least 29 of 30 primary tool decisions are correct;
- combined primary and multi-turn tool selection is at least 95%;
- every emitted tool call is schema-valid;
- no tool arguments contain actor, team, timezone, channel, thread, or user identity;
- no provider, parser, or timeout error occurs.

Reports default to `.copilotkit/artifacts/model-eval/`, which is excluded from Git.

## Q4 to Q6 promotion

Q4 remains the default only after two consecutive passing reports and the performance gates. If Q4 fails, allow one prompt or schema refinement cycle, then run two new clean Q4 suites. If either still fails, run the identical two-suite process with Q6.

Promote Q6 only if it passes reliability and performance gates. If neither quantization passes, do not enable autonomous write tools. Keep the agent read-only and route standup submission through the deterministic Angular form/confirmation flow. There is no silent cloud fallback.

## CI boundary

Default CI uses the injected AI SDK fake model and mocked OpenAI-compatible responses. It never starts llama.cpp or downloads a model. The smoke and evaluation scripts skip unless `RUN_LOCAL_MODEL_TESTS=1`, making local-model verification an explicit developer or dedicated-runner action.
