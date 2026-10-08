import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CypherError } from '@obsigraph/core';
import { z } from 'zod';
import { BackendUnavailable } from '../ladybug/backend.mjs';
import { InputError, type Ops } from '../ops.mjs';
import { UNTRUSTED_NOTICE } from '../rag/retrieve.mjs';
import { VERSION } from '../version.mjs';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

async function answer(fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result as Record<string, unknown> };
  } catch (e) {
    if (e instanceof InputError || e instanceof BackendUnavailable || e instanceof CypherError) {
      const where = e instanceof CypherError && e.line > 0 ? ` (line ${e.line}, column ${e.column})` : '';
      return { isError: true, content: [{ type: 'text' as const, text: `${e.message}${where}` }] };
    }
    throw e;
  }
}

/**
 * MCP server exposing the vault as three read-only tools. A fresh server is
 * built per HTTP request (stateless) or once for stdio.
 */
// @lat: [[sidecar#Interfaces]]
// @tg: implements:: [[openspec:sidecar-mcp-graphrag#Cypher query tool]]
// @tg: implements:: [[openspec:sidecar-mcp-graphrag#MCP server with three tools]]
// @tg: implements:: [[openspec:sidecar-mcp-graphrag#Read-only tools]]
// @tg: implements:: [[openspec:sidecar-mcp-graphrag#Server identity]]
// @tg: implements:: [[openspec:sidecar-mcp-graphrag#Vector search tool]]
export function createMcpServer(ops: Ops): McpServer {
  const server = new McpServer({ name: 'typed-graph', version: VERSION });

  server.registerTool(
    'cypher_query',
    {
      title: 'Cypher query over the vault graph',
      description:
        'Run a read-only openCypher query over the Obsidian vault graph. Notes are nodes labeled by their frontmatter `type`; ' +
        'edges come from `type:: [[Target]] {props}` lines and carry `r.sign` (+1/-1) and `r.id`. Write clauses are rejected. ' +
        'backend "ladybug" runs full read Cypher on the LadybugDB mirror.',
      inputSchema: {
        query: z.string().describe('openCypher read query'),
        params: z.record(z.string(), z.unknown()).optional().describe('Query parameters referenced as $name'),
        backend: z.enum(['builtin', 'ladybug']).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => answer(() => ops.cypher(args)),
  );

  server.registerTool(
    'vector_search',
    {
      title: 'Semantic search over notes or relationships',
      description: `Find notes (target "nodes") or relationships (target "edges") by meaning. Node results cite the best matching chunk with path and heading. An optional "then" Cypher query runs over the hits as $hits and its result comes back with them. ${UNTRUSTED_NOTICE}`,
      inputSchema: {
        query: z.string(),
        target: z.enum(['nodes', 'edges']).optional(),
        k: z.number().int().min(1).max(100).optional(),
        types: z.array(z.string()).optional().describe('Only nodes with one of these types'),
        mode: z.enum(['best', 'pooled']).optional().describe('Node score: best chunk (default) or pooled chunk vector'),
        then: z.string().optional().describe('Follow-up read-only Cypher query run after the search with the hit ids bound to $hits'),
        backend: z.enum(['builtin', 'ladybug']).optional().describe('Backend for the `then` query'),
      },
      annotations: READ_ONLY,
    },
    async (args) => answer(() => ops.search(args)),
  );

  server.registerTool(
    'graphrag_retrieve',
    {
      title: 'GraphRAG retrieve with citations',
      description:
        'Answer-oriented retrieval: semantic hits over notes and relationships, expanded through the graph by `depth` hops with caps, ' +
        `returning the best chunks with citations (path, heading, score, role, distance) and the connecting edges. ${UNTRUSTED_NOTICE}`,
      inputSchema: {
        question: z.string(),
        k: z.number().int().min(1).max(50).optional(),
        depth: z.number().int().min(0).max(3).optional(),
        neighbor_cap: z.number().int().min(1).max(50).optional(),
        chunk_cap: z.number().int().min(1).max(100).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => answer(() => ops.retrieve(args)),
  );

  return server;
}
