import { register, type Command } from '../cli.mjs';

export const mcp: Command = {
  name: 'mcp',
  summary: 'Start the MCP server over stdio',
  usage: 'mcp',
  async run(ctx) {
    // Loaded on demand so the SDK costs nothing for every other command.
    const { createTgMcpServer } = await import('./mcp-server.mjs');
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    await createTgMcpServer(ctx.root, ctx).connect(new StdioServerTransport());
    await new Promise<void>((resolve) => process.stdin.once('close', resolve));
    return 0;
  },
};

register(mcp);
