import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OllamaProvider, OpenAIProvider, type EmbeddingProvider } from '../../sidecar/src/vectors/provider.mjs';
import type { SearchDoc } from '@obsigraph/core';

export interface EmbedConfig {
  provider: EmbeddingProvider;
  /** `kind/model`, part of every cache key. */
  label: string;
}

type Env = Record<string, string | undefined>;

/** Key from `TG_EMBED_KEY[_FILE|_HELPER]`, falling back to the lat.md `LAT_LLM_KEY*` aliases. Never written to disk. */
// @tg: implements:: [[openspec:tg-search#Key variable aliases]]
export function readKey(env: Env): string | null {
  // Family before kind: every TG_EMBED_KEY* variable wins over any LAT_LLM_KEY* alias.
  for (const prefix of ['TG_EMBED_KEY', 'LAT_LLM_KEY'] as const) {
    const direct = env[prefix];
    if (direct) return direct.trim();
    const file = env[`${prefix}_FILE`];
    if (file) return readFileSync(file, 'utf8').trim();
    const helper = env[`${prefix}_HELPER`];
    if (helper) return execSync(helper, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15_000 }).trim();
  }
  return null;
}

/**
 * Embedding provider from the environment, or null for lexical-only search.
 * Nothing is configured by default: no network is touched unless a provider
 * or a key is set. A bare key follows lat.md's convention (`sk-` is OpenAI,
 * `vck_` is the Vercel AI Gateway).
 */
// @tg: implements:: [[openspec:tg-search#Key variable aliases]]
export function embedConfig(env: Env, fetchImpl?: typeof fetch): EmbedConfig | null {
  const kind = (env.TG_EMBED_PROVIDER ?? '').toLowerCase();
  if (kind === 'none') return null;
  const opts = fetchImpl ? { fetch: fetchImpl } : {};
  if (kind === 'ollama') {
    const p = new OllamaProvider({ ...opts, url: env.TG_EMBED_URL, model: env.TG_EMBED_MODEL });
    return { provider: p, label: `ollama/${p.model}` };
  }
  const hasKeySource = Boolean(env.TG_EMBED_KEY ?? env.LAT_LLM_KEY ?? env.TG_EMBED_KEY_FILE ?? env.LAT_LLM_KEY_FILE ?? env.TG_EMBED_KEY_HELPER ?? env.LAT_LLM_KEY_HELPER);
  if (kind === 'openai' || (kind === '' && hasKeySource)) {
    const apiKey = readKey(env);
    const vercel = apiKey?.startsWith('vck_');
    const baseUrl = env.TG_EMBED_URL ?? (vercel ? 'https://ai-gateway.vercel.sh/v1' : 'https://api.openai.com/v1');
    const model = env.TG_EMBED_MODEL ?? (vercel ? 'openai/text-embedding-3-small' : 'text-embedding-3-small');
    return { provider: new OpenAIProvider({ ...opts, baseUrl, model, apiKey }), label: `openai/${model}` };
  }
  if (kind !== '') throw new Error(`unknown TG_EMBED_PROVIDER "${kind}" (expected ollama, openai or none)`);
  return null;
}

const hash = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 16);

export function docText(d: SearchDoc): string {
  return `${d.id}\n${d.summary}\n${d.body}`.slice(0, 2000);
}

interface Meta {
  label: string;
  dimension: number;
  items: Record<string, number>;
}

/** Derived vector cache in `.tg/`: a JSON map of content hash to offset plus a flat float32 file. */
// @tg: implements:: [[openspec:tg-search#Derived cache]]
export class VectorCache {
  private readonly meta: string;
  private readonly bin: string;

  constructor(private readonly dir: string) {
    this.meta = join(dir, 'vectors.json');
    this.bin = join(dir, 'vectors.f32');
  }

  private load(label: string): { meta: Meta; floats: Float32Array } | null {
    try {
      const meta = JSON.parse(readFileSync(this.meta, 'utf8')) as Meta;
      if (meta.label !== label) return null;
      const buf = readFileSync(this.bin);
      return { meta, floats: new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4)) };
    } catch {
      return null;
    }
  }

  /** Vectors for `docs`, embedding only what the cache lacks, then rewriting the cache to hold exactly these docs. */
  async vectorsFor(docs: SearchDoc[], config: EmbedConfig): Promise<{ vectors: number[][]; embedded: number; reused: number }> {
    const keys = docs.map((d) => hash(docText(d)));
    const cached = this.load(config.label);
    const have = new Map<string, number[]>();
    if (cached) {
      const dim = cached.meta.dimension;
      for (const [k, off] of Object.entries(cached.meta.items)) have.set(k, Array.from(cached.floats.subarray(off * dim, off * dim + dim)));
    }
    const missing = [...new Set(keys.filter((k) => !have.has(k)))];
    if (missing.length) {
      const byKey = new Map(docs.map((d, i) => [keys[i]!, d] as const));
      const vecs = await config.provider.embed(missing.map((k) => docText(byKey.get(k)!)));
      missing.forEach((k, i) => have.set(k, vecs[i]!));
    }
    const vectors = keys.map((k) => have.get(k)!);
    const unique = [...new Set(keys)];
    const dimension = vectors[0]?.length ?? 0;
    if (dimension && (missing.length || !cached || Object.keys(cached.meta.items).length !== unique.length)) {
      mkdirSync(this.dir, { recursive: true });
      if (!existsSync(join(this.dir, '.gitignore'))) writeFileSync(join(this.dir, '.gitignore'), '*\n');
      const floats = new Float32Array(unique.length * dimension);
      const items: Record<string, number> = {};
      unique.forEach((k, i) => {
        items[k] = i;
        floats.set(have.get(k)!, i * dimension);
      });
      writeFileSync(this.bin, Buffer.from(floats.buffer));
      writeFileSync(this.meta, JSON.stringify({ label: config.label, dimension, items } satisfies Meta));
    }
    return { vectors, embedded: missing.length, reused: unique.length - missing.length };
  }
}
