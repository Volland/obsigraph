# Demo recordings

Scripts that produce the clips in `site/assets/demos/`, from real runs.

- `zettelkasten.mjs` drives the live demo page (needs `npm run site:build` and `python3 -m http.server 8765` in `site/`) over `ontologies/zettelkasten`.
- `transcript.mjs <project>` runs the real `tg` CLI (`npm run build -w @typedgraph/cli` first) over an example project and writes `transcript.json`; `code.mjs` replays it in `term.html`.

Both use `playwright-core` with a local Chrome (`npm i playwright-core` outside the repo). Playwright's video recorder needs ffmpeg at `~/Library/Caches/ms-playwright/ffmpeg-<n>/ffmpeg-mac`; a symlink to a system ffmpeg works. Encode with `ffmpeg -vf "fps=20,scale=1000:-2" -c:v libx264 -crf 27 -pix_fmt yuv420p` (and `libvpx-vp9 -crf 38 -b:v 0` for WebM); keep each clip under about 400 KB.
