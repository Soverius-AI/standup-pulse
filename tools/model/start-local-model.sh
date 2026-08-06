#!/usr/bin/env bash
set -euo pipefail

model_quant="${1:-q4}"
model_repository="unsloth/gemma-4-26B-A4B-it-GGUF"

case "${model_quant}" in
  q4)
    model_tag="UD-Q4_K_M"
    model_alias="standup-gemma-4-26b-a4b-q4"
    ;;
  q6)
    model_tag="UD-Q6_K_XL"
    model_alias="standup-gemma-4-26b-a4b-q6"
    ;;
  *)
    echo "Usage: $0 [q4|q6]" >&2
    exit 2
    ;;
esac

model_path="${LOCAL_LLM_MODEL_PATH:-}"
if [[ -n "${model_path}" ]]; then
  if [[ ! -f "${model_path}" ]]; then
    echo "LOCAL_LLM_MODEL_PATH is not a file: ${model_path}" >&2
    exit 2
  fi
  model_source=(--model "${model_path}")
else
  echo "LOCAL_LLM_MODEL_PATH is unset; llama.cpp will fetch/cache ${model_repository}:${model_tag}." >&2
  model_source=(-hf "${model_repository}:${model_tag}")
fi

exec llama-server \
  "${model_source[@]}" \
  --alias "${model_alias}" \
  --host 127.0.0.1 \
  --port "${LOCAL_LLM_PORT:-8080}" \
  --ctx-size "${LOCAL_LLM_CONTEXT_SIZE:-131072}" \
  --parallel 1 \
  --n-gpu-layers 99 \
  --flash-attn on \
  --jinja \
  --metrics \
  --temp 1.0 \
  --top-p 0.95 \
  --top-k 64
