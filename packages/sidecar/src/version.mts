import { readFileSync } from 'node:fs';

declare const __SIDECAR_VERSION__: string;

/** The sidecar package version: injected by the build, read from package.json when running from source. */
// @tg: implements:: [[openspec:sidecar-mcp-graphrag#Server identity]]
export const VERSION: string =
  typeof __SIDECAR_VERSION__ === 'string' ? __SIDECAR_VERSION__ : (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
