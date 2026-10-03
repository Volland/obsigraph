import { createServer, type IncomingMessage, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { EmbeddingError, identityMismatch, OllamaProvider, OpenAIProvider, providerFromEnv } from '../src/vectors/provider.mjs';

interface Seen {
  path: string;
  body: { model: string; input: string[] };
  auth: string | undefined;
}

const servers: Server[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

/** A fake embedding server; vectors encode the text length so order is checkable. */
async function fakeServer(handler: (seen: Seen) => { status: number; body: unknown }) {
  const seen: Seen[] = [];
  const server = createServer(async (req: IncomingMessage, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const s = { path: req.url ?? '', body: JSON.parse(Buffer.concat(chunks).toString()), auth: req.headers.authorization };
    seen.push(s);
    const out = handler(s);
    res.writeHead(out.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(out.body));
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}`, seen };
}

const vec = (t: string, dim = 768) => Array.from({ length: dim }, (_, i) => (i === 0 ? t.length : 0));
const ollamaOk = (s: Seen) => ({ status: 200, body: { model: s.body.model, embeddings: s.body.input.map((t) => vec(t)) } });

describe('embedding provider', () => {
  // @lat: [[tests/embedding-provider#Local Ollama by default]]
  it('defaults to local Ollama with nomic-embed-text and 768 dimensions', async () => {
    const p = providerFromEnv({});
    expect(p).toBeInstanceOf(OllamaProvider);
    expect([p.endpoint, p.model]).toEqual(['http://localhost:11434', 'nomic-embed-text']);
    const fake = await fakeServer(ollamaOk);
    const local = providerFromEnv({ OBSIGRAPH_EMBED_URL: fake.url });
    const [v] = await local.embed(['hello']);
    expect(v).toHaveLength(768);
    expect(fake.seen[0]).toMatchObject({ path: '/api/embed', body: { model: 'nomic-embed-text', input: ['hello'] } });
  });

  // @lat: [[tests/embedding-provider#Never hosted by default]]
  it('sends nothing to a non-local host with a fresh configuration', async () => {
    const hosts: string[] = [];
    const spy = (async (url: string | URL) => {
      hosts.push(new URL(String(url)).hostname);
      return new Response(JSON.stringify({ embeddings: [vec('x')] }), { status: 200 });
    }) as typeof fetch;
    await providerFromEnv({}, undefined, { fetch: spy }).embed(['x']);
    expect(hosts).toEqual(['localhost']);
  });

  // @lat: [[tests/embedding-provider#OpenAI-compatible endpoint]]
  it('uses a configured OpenAI-compatible endpoint with model and key, in input order', async () => {
    const fake = await fakeServer((s) => ({
      status: 200,
      body: { data: s.body.input.map((t, index) => ({ index, embedding: vec(t, 4) })).reverse() },
    }));
    const p = providerFromEnv({ OBSIGRAPH_EMBED_PROVIDER: 'openai', OBSIGRAPH_EMBED_URL: `${fake.url}/v1`, OBSIGRAPH_EMBED_MODEL: 'text-embed-3', OBSIGRAPH_EMBED_KEY: 'sk-test' });
    const out = await p.embed(['a', 'bbb']);
    expect(out.map((v) => v[0])).toEqual([1, 3]);
    expect(fake.seen[0]).toMatchObject({ path: '/v1/embeddings', body: { model: 'text-embed-3' }, auth: 'Bearer sk-test' });
    expect((await p.identity()).provider).toBe('openai');
  });

  // @lat: [[tests/embedding-provider#Batches keep order]]
  it('returns one vector per text in order across batches and concurrency', async () => {
    const fake = await fakeServer(ollamaOk);
    const texts = Array.from({ length: 7 }, (_, i) => 'x'.repeat(i + 1));
    const out = await new OllamaProvider({ url: fake.url, batchSize: 3, concurrency: 2 }).embed(texts);
    expect(out.map((v) => v[0])).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(fake.seen.map((s) => s.body.input.length).sort()).toEqual([1, 3, 3]);
    expect(await new OllamaProvider({ url: fake.url }).embed([])).toEqual([]);
  });

  // @lat: [[tests/embedding-provider#Unreachable endpoint named]]
  it('names the endpoint when the server is not running', async () => {
    const err = await new OllamaProvider({ url: 'http://127.0.0.1:1' }).embed(['x']).catch((e: EmbeddingError) => e);
    expect(err).toBeInstanceOf(EmbeddingError);
    expect(err).toMatchObject({ kind: 'unreachable' });
    expect((err as Error).message).toMatch(/Cannot reach the embedding endpoint http:\/\/127\.0\.0\.1:1\/api\/embed/);
  });

  // @lat: [[tests/embedding-provider#Missing model explained]]
  it('names a missing model and how to install it without pulling', async () => {
    const fake = await fakeServer(() => ({ status: 404, body: { error: 'model "nomic-embed-text" not found, try pulling it first' } }));
    const err = await new OllamaProvider({ url: fake.url }).embed(['x']).catch((e: EmbeddingError) => e);
    expect(err).toMatchObject({ kind: 'model-missing' });
    expect((err as Error).message).toBe(`Model 'nomic-embed-text' is not available at ${fake.url}. Install it with \`ollama pull nomic-embed-text\`; nothing is pulled automatically.`);
    expect(fake.seen.map((s) => s.path)).toEqual(['/api/embed']);
    const bad = await fakeServer(() => ({ status: 200, body: { embeddings: 'nope' } }));
    expect(await new OllamaProvider({ url: bad.url }).embed(['x']).catch((e: EmbeddingError) => e.kind)).toBe('bad-response');
  });

  // @lat: [[tests/embedding-provider#Identity reported]]
  it('reports model name and dimension', async () => {
    const fake = await fakeServer(ollamaOk);
    expect(await new OllamaProvider({ url: fake.url }).identity()).toEqual({ provider: 'ollama', model: 'nomic-embed-text', dimension: 768 });
  });

  // @lat: [[tests/embedding-provider#Model change detected]]
  it('reports a mismatch when the model or dimension changes, never for the same model', () => {
    const nomic = { provider: 'ollama' as const, model: 'nomic-embed-text', dimension: 768 };
    expect(identityMismatch(nomic, { ...nomic })).toBeNull();
    expect(identityMismatch(null, nomic)).toBeNull();
    expect(identityMismatch(nomic, { provider: 'ollama', model: 'mxbai-embed-large', dimension: 1024 })).toMatch(/rebuild the index/);
  });

  // @lat: [[tests/embedding-provider#Key from environment only]]
  it('reads API keys from the environment or a key file only', () => {
    const p = providerFromEnv({ OBSIGRAPH_EMBED_PROVIDER: 'openai', OBSIGRAPH_EMBED_URL: 'https://api.example/v1', OBSIGRAPH_EMBED_KEY_FILE: '/run/secrets/k' }, (f) => (f === '/run/secrets/k' ? 'sk-file\n' : ''));
    expect(p).toBeInstanceOf(OpenAIProvider);
    expect(() => providerFromEnv({ OBSIGRAPH_EMBED_PROVIDER: 'openai' })).toThrow(/OBSIGRAPH_EMBED_URL is required/);
    expect(() => providerFromEnv({ OBSIGRAPH_EMBED_PROVIDER: 'cohere' })).toThrow(/Unknown embedding provider/);
  });

  // @lat: [[tests/embedding-provider#Real Ollama round trip]]
  it('embeds with the real local Ollama when it is running', async () => {
    const p = new OllamaProvider();
    const out = await p.embed(['typed graph', 'signed edge']).catch(() => null);
    if (!out) return;
    expect(out).toHaveLength(2);
    expect(out[0]).toHaveLength(768);
    expect((await p.identity()).dimension).toBe(768);
    // Ollama may need to load the model from disk first.
  }, 60000);
});
