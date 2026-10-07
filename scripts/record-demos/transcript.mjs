import { execSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
const P = process.argv[2];
const TG = new URL('../../packages/cli/dist/tg.mjs', import.meta.url).pathname;
const sh = (c) => { try { return execSync(c, { cwd: P, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: '/bin/bash' }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } };
rmSync(`${P}/src/limit.ts`, { force: true });
const UNIMPL = `tg cypher "MATCH (s:Section) OPTIONAL MATCH (c:CodeSymbol)-[:implements]->(s) WITH s, count(c) AS n WHERE n = 0 AND s.depth = 2 AND s.file = 'lat.md/requirements.md' RETURN s.title AS requirement"`;
const run = (cmd) => ({ cmd, out: sh(cmd.replace(/^tg /, `node ${TG} `)).trimEnd() });
const steps = [];
{ const r = run('ls -d lat.md/*.md openspec/changes/* src/*'); r.out = r.out.split('\n').join('   '); steps.push(r); }
steps.push(run('tg check'));
steps.push(run(UNIMPL));
const AT = '@' + 'tg:'; // keeps tg check from reading these examples as annotations
const code = `// ${AT} implements:: [[requirements#Rate limiting]]\nexport function limit(client: string) {}\n`;
sh(`cat > src/limit.ts <<'X'\n${code}X`);
steps.push({ cmd: 'cat src/limit.ts', out: code.trimEnd() });
steps.push(run(UNIMPL));
steps.push(run(`tg cypher "MATCH (c:CodeSymbol)-[e:contradicts]->(s:Section) RETURN c.name AS code, s.title AS against, e.until AS until"`));
sh(`cat >> src/limit.ts <<'X'\n\n// ${AT} implements:: [[requirements#Rate limitting]]\nexport function oops() {}\nX`);
steps.push({ cmd: "sed -n '4,5p' src/limit.ts", out: `// ${AT} implements:: [[requirements#Rate limitting]]\nexport function oops() {}` });
steps.push(run('tg check'));
sh('rm src/limit.ts');
writeFileSync(new URL('transcript.json', import.meta.url).pathname, JSON.stringify(steps, null, 1));
for (const s of steps) console.log('$', s.cmd, '\n' + s.out + '\n');
