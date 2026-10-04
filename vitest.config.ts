import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The CLI bundles its markdown templates as text (esbuild's `text` loader); mirror that here.
  plugins: [
    {
      name: 'md-as-text',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('.md') && id.includes('/packages/cli/templates/')) return { code: `export default ${JSON.stringify(code)};`, map: null };
        return null;
      },
    },
  ],
  test: { include: ['packages/*/test/**/*.test.ts'], exclude: ['**/node_modules/**', '**/fixtures/**'] },
});
