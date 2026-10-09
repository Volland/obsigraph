## Context

Obsidian's community store installs only `main.js`, `manifest.json` and `styles.css`; its developer policies forbid plugins to install or update themselves or their dependencies and require network use to be disclosed in the README, and an automated review scans every release (ADR 0002). The plugin is not desktop-only. Mobile WebViews give no background execution on iOS. Plugin settings in `data.json` are synced by Obsidian Sync and file-based sync tools along with `.obsidian/`.

## Goals / Non-Goals

**Goals:**
- Search by meaning on phones, with the model's identity and state always visible.
- No surprise downloads, CPU or storage costs.
- Same results as `tg search` for the same corpus and model.

**Non-Goals:**
- Chat or answer generation inside Obsidian.
- Remote embedding endpoints in the plugin (keys would live in synced settings).
- Replacing Obsidian's core search for plain text.

## Decisions

**1. Search view.** An `ItemView` leaf. Controls: query box (search as you type after 250 ms idle, Enter forces), mode (Hybrid, Lexical, Semantic), type filter (from schema types), target (Notes, Passages, Relationships). Results show title, type chips, heading path, a snippet with matches marked, up to three Facts as `type → target` chips, and a "why?" toggle rendering the explanation. Tap opens the note scrolled to the Chunk's heading. On phones the leaf opens in the main area full screen.

**2. Status chip.** One line above results, always present, tap opens Settings → Search:
- `Semantic · <model> · <n>% embedded · <k> waiting`
- `Lexical only on this device`
- `Re-indexing for <model> · <n>%`
- `Model not downloaded · set up`
- `Index rebuilding · <n>%` (structural phase after a format change or eviction)

**3. Related notes.** A side leaf following the active file: top 10 nodes by cosine to the active note's Card vector by exact scan, fused with its graph neighbors by the same RRF and boost, excluding itself. It needs no query embedding, so it works when the model is not downloaded but the store has vectors from the pack. It shows "No vectors yet" otherwise.

**4. Copy context pack.** A button in the search view and a command; runs retrieve for the current query (depth 1, budget 16,000 characters), renders markdown with a header naming the vault and query, each Chunk as a quote with `[[path#heading]]` citation, and the connecting Facts; copies to the clipboard and shows a notice with the character count.

**5. Model choice scope.** The fingerprint chosen for the vault lives in `data.json` (synced). "Semantic search on this device" and "Pause indexing" live in `localStorage` keyed by vault id (not synced). When a device sees a synced fingerprint different from its store's, it starts a shadow build (pack first) unless semantic search is off on this device.

**6. First run.** Triggered the first time the search view opens with no model chosen for the vault, or from settings. It samples up to 200 notes and computes the share of letters outside Latin script. Above 10% it recommends `e5-small-multi` and says the English model would not understand those notes; otherwise `minilm-l6`. Each option shows download size, estimated indexing time for this vault on this device (units × measured per-unit time from a 10-text benchmark run at setup), and "runs well / slow / not recommended on this device" (thresholds on estimated time and device memory). Choosing "Not now" keeps lexical search.

**7. Weight download.** `requestUrl` from a URL pinned in the plugin per preset version, to IndexedDB (per device, not synced: weights are large and the same everywhere), verified by sha256 before use; failure leaves the previous state untouched. Download only after explicit user action. Weights are data; no code is fetched (ADR 0002).

**8. Model change.** "Change model…" opens a confirmation with: units to embed, estimated time on this device, download size, "your current search keeps working meanwhile", and a note that other devices will switch too. Confirmed, the choice is written to `data.json` and the shadow build starts.

**9. Mobile behavior.** Phase 2 runs only while the app is in the foreground and the user has not typed for 2 s, in slices of at most 50 ms of main-thread work (embedding itself runs in its Worker); pauses on `visibilitychange` hidden; "Pause indexing on this device" stops it entirely.

## Risks / Trade-offs

- [Policy review flags the download] → Only weights are fetched, after a user action, from a disclosed URL; README states it; no code is downloaded.
- [Phones with little storage] → Model card shows store and weights size; "Delete local store" and "semantic search off on this device" free it.
- [Synced model change forces work on every device] → The pack makes it mostly a download; a device can opt out.
- [Script-share heuristic misjudges] → It only recommends; the user chooses.

## Migration Plan

New feature; no existing plugin state changes. Users who never open search pay only the `main.js` size.

## Open Questions

- Whether Related notes should also appear in the existing graph view as a highlight mode.
