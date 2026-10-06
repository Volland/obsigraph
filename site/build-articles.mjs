// Render the long-form articles in articles/*.md into flat blog pages in site/.
// The Markdown stays the source; run `npm run site:articles` after editing one.
import { readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';

const POSTS = [
  {
    src: 'articles/typed-graph-for-coders.md',
    out: 'site/blog-typed-graph-for-coders.html',
    title: 'Two Graphs in Your Codebase',
    description: 'A deep dive into typed graphs for developers: what to model, what to leave to the machine, why specs are code now, and a small ontology for intent and code.',
    related: ['blog-code-ontology.html', 'One vocabulary for the whole team: using the code ontology'],
  },
  {
    src: 'articles/code-ontology-in-practice.md',
    out: 'site/blog-code-ontology.html',
    title: 'Using the Code Ontology',
    description: 'One small ontology that tg init installs: how developers, architects, product people and coding agents use it, and how it exports to SHACL.',
    related: ['blog-typed-graph-for-coders.html', 'Your codebase has two graphs. You only maintain one.'],
  },
  {
    src: 'articles/composable-ontologies.md',
    out: 'site/blog-composable-ontologies.html',
    title: 'Composable Ontology Graphs',
    description: 'A gallery of downloadable ontologies as plain Markdown (Zettelkasten, books, requirements, prompts and agents) and the rules for combining them: a shared core, multi-label notes and mixins.',
    related: ['ontologies.html', 'The ontology gallery: download and use'],
  },
];
const LINKS = { 'typed-graph-for-coders.md': 'blog-typed-graph-for-coders.html', 'code-ontology-in-practice.md': 'blog-code-ontology.html', 'composable-ontologies.md': 'blog-composable-ontologies.html' };
const DATE = '6 October 2026';

const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

marked.use({
  renderer: {
    code: ({ text }) => `<pre>${escape(text)}</pre>\n`,
    link({ href, tokens }) {
      return `<a href="${escape(LINKS[href] ?? href)}">${this.parser.parseInline(tokens)}</a>`;
    },
  },
});

for (const p of POSTS) {
  const lines = readFileSync(p.src, 'utf8').split('\n');
  const heading = lines.shift().replace(/^# /, '');
  const rest = lines.join('\n').trim();
  const sub = /^\*(.+?)\*\n/.exec(rest);
  const body = rest.slice(sub ? sub[0].length : 0).replace(/^\s*---\s*\n/, '').replace(/\n---\s*\n(?=\*[^\n]+\*\s*$)/, '\n');
  // Code samples hold @tg: examples; keep tg check from reading this page as annotations.
  const html = marked.parse(body).replace(/@(tg|lat):/g, '@<span></span>$1:').trimEnd().replace(/<p><em>([^]*)<\/em><\/p>$/, '<p class="note"><em>$1</em></p>');
  const [relHref, relTitle] = p.related;
  writeFileSync(
    p.out,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(p.title)}</title>
  <meta name="description" content="${escape(p.description)}">
  <meta property="og:title" content="${escape(heading)}">
  <meta property="og:description" content="${escape(p.description)}">
  <meta property="og:image" content="https://volland.github.io/obsigraph/assets/og.png">
  <meta property="og:type" content="article">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/style.css">
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="./"><img src="assets/logo.svg" alt="">Typed Graph</a>
      <nav class="nav">
        <a href="./">Home</a>
        <a href="docs.html">Docs</a>
        <a href="demo.html">Demo</a>
        <a href="example.html">Example</a>
        <a href="blog.html" class="active">Blog</a>
        <a href="https://github.com/Volland/obsigraph">GitHub</a>
        <button class="theme-toggle" aria-label="Toggle theme">☾</button>
      </nav>
    </div>
  </header>

  <main class="wrap post">
    <div class="meta"><a href="blog.html">Blog</a> · ${DATE} · Volodymyr Pavlyshyn</div>
    <h1>${escape(heading)}</h1>
${sub ? `    <p class="standfirst">${marked.parseInline(sub[1])}</p>\n` : ''}
${html}

    <div class="next">Related: <a href="${relHref}">${escape(relTitle)} →</a></div>
  </main>

  <footer>
    <div class="wrap">
      <span>Typed Graph · MIT · by Volodymyr Pavlyshyn. Not affiliated with Obsidian, LadybugDB or lat.md.</span>
      <span><a href="docs.html">Docs</a> · <a href="blog.html">Blog</a> · <a href="https://github.com/Volland/obsigraph">GitHub</a> · <a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a> · <a href="agb.html">AGB</a></span>
    </div>
  </footer>
  <script src="assets/site.js"></script>
</body>
</html>
`,
  );
}
