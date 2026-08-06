#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const REPOSITORY = 'unsloth/gemma-4-26B-A4B-it-GGUF';
const QUANTS = {
  q4: { tag: 'UD-Q4_K_M', alias: 'standup-gemma-4-26b-a4b-q4' },
  q6: { tag: 'UD-Q6_K_XL', alias: 'standup-gemma-4-26b-a4b-q6' },
};

function parseArguments(values) {
  const [command, ...rest] = values;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!argument.startsWith('--'))
      throw new Error(`Unexpected argument: ${argument}`);
    if (argument === '--force') {
      options.force = true;
      continue;
    }
    const value = rest[index + 1];
    if (!value || value.startsWith('--'))
      throw new Error(`Missing value for ${argument}`);
    options[argument.slice(2)] = value;
    index += 1;
  }
  return { command, options };
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function llamaVersion() {
  return execFileSync('llama-server', ['--version'], {
    encoding: 'utf8',
  }).trim();
}

function requireFile(filePath, description) {
  if (!filePath || !existsSync(filePath))
    throw new Error(
      `${description} does not exist: ${filePath ?? '(missing)'}`,
    );
}

async function capture(options) {
  const quant = options.quant ?? 'q4';
  const quantConfig = QUANTS[quant];
  if (!quantConfig) throw new Error('--quant must be q4 or q6');
  requireFile(options.model, 'Model');
  if (!options.output) throw new Error('--output is required');

  const outputPath = resolve(options.output);
  if (existsSync(outputPath) && !options.force) {
    throw new Error(
      `Refusing to overwrite ${outputPath}; pass --force intentionally`,
    );
  }

  const modelPath = resolve(options.model);
  const modelStat = await import('node:fs/promises').then(({ stat }) =>
    stat(modelPath),
  );
  const manifest = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    repository: REPOSITORY,
    repositoryRevision: options.revision ?? null,
    quantization: quantConfig.tag,
    modelAlias: quantConfig.alias,
    fileName: basename(modelPath),
    bytes: modelStat.size,
    sha256: await sha256(modelPath),
    llamaCppVersion: llamaVersion(),
    launch: {
      host: '127.0.0.1',
      port: 8080,
      contextSize: 131072,
      parallel: 1,
      flashAttention: true,
      jinja: true,
      metrics: true,
      temperature: 1,
      topP: 0.95,
      topK: 64,
      thinking: false,
    },
  };
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Captured ${outputPath}`);
}

async function verify(options) {
  requireFile(options.manifest, 'Manifest');
  requireFile(options.model, 'Model');
  const manifest = JSON.parse(readFileSync(options.manifest, 'utf8'));
  const actualHash = await sha256(resolve(options.model));
  const actualVersion = llamaVersion();
  const failures = [];
  if (actualHash !== manifest.sha256)
    failures.push(`SHA-256 mismatch: ${actualHash}`);
  if (actualVersion !== manifest.llamaCppVersion)
    failures.push(`llama.cpp mismatch: ${actualVersion}`);
  if (basename(options.model) !== manifest.fileName)
    failures.push(`Filename mismatch: ${basename(options.model)}`);
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`Verified ${manifest.modelAlias} (${manifest.sha256})`);
}

const { command, options } = parseArguments(process.argv.slice(2));
try {
  if (command === 'capture') await capture(options);
  else if (command === 'verify') await verify(options);
  else
    throw new Error(
      'Usage: manifest.mjs capture --model PATH --output PATH [--quant q4|q6] [--revision SHA] [--force]\n       manifest.mjs verify --manifest PATH --model PATH',
    );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
