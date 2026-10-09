---
status: accepted
---
# Per-device graph store, shared content-addressed vector pack

A database file in a synced folder (Obsidian Sync, iCloud, Syncthing) gets written by two devices and ends up as a conflict copy or corrupted. So the plugin's graph store lives only in per-device storage (IndexedDB through Ladybug's IDBFS backend, keyed by vault) and is never synced. To spare phones from embedding the whole vault, every device also writes the vectors it computes to a vector pack in the synced plugin folder, one file per chunk named by the hash of its embedded text under a directory per model fingerprint. Identical content embeds to byte-identical files, so concurrent writes from two devices cannot conflict; files are only added, then pruned when no note references them. Indexing reads the pack before embedding anything. A setting turns the pack off.

## Considered Options

- **Everything per device.** Safest and simplest, but a phone embeds the whole vault on single-threaded WASM.
- **Graph store in the synced plugin folder.** Conflicts and corruption.

## Consequences

- The pack costs roughly 770 bytes per chunk (float16 × 384) of synced storage.
- Vectors in the pack are only reusable when the model fingerprint matches exactly, so the fingerprint must cover everything that changes a vector.
