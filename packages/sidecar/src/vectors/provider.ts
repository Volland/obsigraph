/** Which model produced a set of vectors; stored with every index. */
export interface EmbeddingIdentity {
  provider: 'ollama' | 'openai';
  model: string;
  dimension: number;
}

export interface EmbeddingProvider {
  /** Endpoint the provider talks to, for status and errors. */
  readonly endpoint: string;
  readonly model: string;
  /** Model name and vector dimension (probes once if needed). */
  identity(): Promise<EmbeddingIdentity>;
  /** One vector per text, in input order. */
  embed(texts: string[]): Promise<number[][]>;
}

export type EmbeddingErrorKind = 'unreachable' | 'model-missing' | 'bad-response' | 'http';

export class EmbeddingError extends Error {
  constructor(
    readonly kind: EmbeddingErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

type Fetch = typeof fetch;

interface BatchOptions {
  batchSize?: number;
  concurrency?: number;
  fetch?: Fetch;
}

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_EMBED_MODEL = 'nomic-embed-text';

/** Split into batches and run a bounded number at a time, keeping input order. */
async function batched(texts: string[], size: number, concurrency: number, run: (batch: string[]) => Promise<number[][]>): Promise<number[][]> {
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += size) batches.push(texts.slice(i, i + size));
  const out: number[][][] = new Array(batches.length);
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const i = next++;
      out[i] = await run(batches[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker));
  return out.flat();
}

async function post(f: Fetch, url: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: unknown; text: string }> {
  let res: Response;
  try {
    res = await f(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  } catch (e) {
    const cause = (e as { cause?: { code?: string } }).cause?.code ?? (e as Error).message;
    throw new EmbeddingError('unreachable', `Cannot reach the embedding endpoint ${url} (${cause}). Is the server running?`);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

function checkVectors(vectors: unknown, count: number, endpoint: string): number[][] {
  if (!Array.isArray(vectors) || vectors.length !== count || !vectors.every((v) => Array.isArray(v) && v.every((x) => typeof x === 'number'))) {
    throw new EmbeddingError('bad-response', `The embedding endpoint ${endpoint} returned an unexpected response`);
  }
  return vectors;
}

abstract class BaseProvider implements EmbeddingProvider {
  private dim: number | null = null;
  constructor(
    readonly endpoint: string,
    readonly model: string,
    private readonly kind: EmbeddingIdentity['provider'],
    protected readonly opts: BatchOptions,
  ) {}

  async identity(): Promise<EmbeddingIdentity> {
    if (this.dim === null) this.dim = (await this.embed(['dimension probe']))[0]!.length;
    return { provider: this.kind, model: this.model, dimension: this.dim };
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const vectors = await batched(texts, this.opts.batchSize ?? 32, this.opts.concurrency ?? 2, (b) => this.request(b));
    this.dim ??= vectors[0]?.length ?? null;
    return vectors;
  }

  protected abstract request(batch: string[]): Promise<number[][]>;

  protected get fetch(): Fetch {
    return this.opts.fetch ?? globalThis.fetch;
  }
}

/** Local Ollama via `/api/embed`; the default, never a hosted service. */
// @lat: [[vector-search#Embedding provider]]
export class OllamaProvider extends BaseProvider {
  constructor(opts: BatchOptions & { url?: string; model?: string } = {}) {
    super((opts.url ?? DEFAULT_OLLAMA_URL).replace(/\/+$/, ''), opts.model ?? DEFAULT_EMBED_MODEL, 'ollama', opts);
  }
  protected async request(batch: string[]): Promise<number[][]> {
    const url = `${this.endpoint}/api/embed`;
    const r = await post(this.fetch, url, { model: this.model, input: batch });
    const err = (r.json as { error?: string } | null)?.error;
    if (r.status === 404 || (err && /not found|pull/i.test(err))) {
      throw new EmbeddingError('model-missing', `Model '${this.model}' is not available at ${this.endpoint}. Install it with \`ollama pull ${this.model}\`; nothing is pulled automatically.`);
    }
    if (r.status !== 200) throw new EmbeddingError('http', `Embedding request to ${url} failed with HTTP ${r.status}${err ? `: ${err}` : ''}`);
    return checkVectors((r.json as { embeddings?: unknown } | null)?.embeddings, batch.length, url);
  }
}

/** Any OpenAI-compatible `/embeddings` endpoint (base URL, model, optional key). */
export class OpenAIProvider extends BaseProvider {
  constructor(private readonly o: BatchOptions & { baseUrl: string; model: string; apiKey?: string | null }) {
    super(o.baseUrl.replace(/\/+$/, ''), o.model, 'openai', o);
  }
  protected async request(batch: string[]): Promise<number[][]> {
    const url = `${this.endpoint}/embeddings`;
    const r = await post(this.fetch, url, { model: this.model, input: batch }, this.o.apiKey ? { authorization: `Bearer ${this.o.apiKey}` } : {});
    const message = (r.json as { error?: { message?: string } } | null)?.error?.message;
    if (r.status === 404 || (message && /model/i.test(message) && /not|exist|found/i.test(message))) {
      throw new EmbeddingError('model-missing', `Model '${this.model}' is not available at ${this.endpoint}${message ? `: ${message}` : ''}`);
    }
    if (r.status === 401 || r.status === 403) throw new EmbeddingError('http', `The embedding endpoint ${this.endpoint} rejected the API key (HTTP ${r.status})`);
    if (r.status !== 200) throw new EmbeddingError('http', `Embedding request to ${url} failed with HTTP ${r.status}${message ? `: ${message}` : ''}`);
    const data = (r.json as { data?: { index: number; embedding: number[] }[] } | null)?.data;
    if (!Array.isArray(data)) throw new EmbeddingError('bad-response', `The embedding endpoint ${url} returned an unexpected response`);
    return checkVectors([...data].sort((a, b) => a.index - b.index).map((d) => d.embedding), batch.length, url);
  }
}

/** Provider from `OBSIGRAPH_EMBED_*` settings; defaults to local Ollama. Keys come from env or a file, never notes. */
export function providerFromEnv(env: Record<string, string | undefined>, readFile?: (path: string) => string, opts: BatchOptions = {}): EmbeddingProvider {
  const kind = (env.OBSIGRAPH_EMBED_PROVIDER ?? 'ollama').toLowerCase();
  const batchSize = env.OBSIGRAPH_EMBED_BATCH ? Number(env.OBSIGRAPH_EMBED_BATCH) : opts.batchSize;
  if (kind === 'openai') {
    if (!env.OBSIGRAPH_EMBED_URL) throw new EmbeddingError('http', 'OBSIGRAPH_EMBED_URL is required for an OpenAI-compatible provider');
    let apiKey = env.OBSIGRAPH_EMBED_KEY ?? null;
    if (!apiKey && env.OBSIGRAPH_EMBED_KEY_FILE && readFile) apiKey = readFile(env.OBSIGRAPH_EMBED_KEY_FILE).trim();
    return new OpenAIProvider({ ...opts, batchSize, baseUrl: env.OBSIGRAPH_EMBED_URL, model: env.OBSIGRAPH_EMBED_MODEL ?? DEFAULT_EMBED_MODEL, apiKey });
  }
  if (kind !== 'ollama') throw new EmbeddingError('http', `Unknown embedding provider '${kind}' (expected ollama or openai)`);
  return new OllamaProvider({ ...opts, batchSize, url: env.OBSIGRAPH_EMBED_URL, model: env.OBSIGRAPH_EMBED_MODEL });
}

/** A reason when vectors from `active` must not be written into an index built with `stored`. */
// @lat: [[vector-search#Embedding provider]]
export function identityMismatch(stored: EmbeddingIdentity | null, active: EmbeddingIdentity): string | null {
  if (!stored) return null;
  if (stored.model === active.model && stored.dimension === active.dimension && stored.provider === active.provider) return null;
  return `The index was built with ${stored.provider}/${stored.model} (${stored.dimension} dims) but the active model is ${active.provider}/${active.model} (${active.dimension} dims); rebuild the index to switch models.`;
}
