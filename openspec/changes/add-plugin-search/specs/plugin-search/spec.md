## Purpose

Defines search inside the Obsidian plugin on desktop and mobile: the search view, the model status shown with every search, related notes and the copyable context pack.

## ADDED Requirements

### Requirement: Search view
The plugin SHALL provide a search view, opened by the command "Typed Graph: Search" and a ribbon icon, with a query box and controls for mode, type filter and target, and SHALL show results from the shared ranking pipeline with title, type labels, heading path, snippet and up to three matching Facts.

#### Scenario: Search a vault
- **WHEN** the user types "who works on search" in the search view
- **THEN** grouped results appear with their best passage and matching relationships

#### Scenario: Same results as the CLI
- **WHEN** the same vault and model are searched in the plugin and with `tg search` pointed at the vault
- **THEN** both return the same top results in the same order

### Requirement: Open at the matching heading
Selecting a result SHALL open its note scrolled to the heading of the matched Chunk.

#### Scenario: Passage under a subheading
- **WHEN** the best Chunk of a result is under "Design › Trade-offs"
- **THEN** the note opens at that heading

### Requirement: Model status always visible
The search view SHALL always show the current search state: the model name with the share of units embedded and the number waiting, lexical-only on this device, a model switch in progress with its progress, model not downloaded, or index rebuilding; selecting it SHALL open the search settings.

#### Scenario: Partly embedded
- **WHEN** 980 of 1,000 units have vectors
- **THEN** the view shows the model name, 98% embedded and 20 waiting

#### Scenario: Semantic off on this device
- **WHEN** semantic search is off on this device
- **THEN** the view says lexical only on this device and results come from full-text lists

### Requirement: Explanation on request
Each result SHALL offer an explanation showing its per-list ranks, fused score, boost and the nodes that caused the boost.

#### Scenario: Why shown
- **WHEN** the user opens "why?" on a result
- **THEN** its ranks per list and its boost sources are shown

### Requirement: Related notes
The plugin SHALL provide a related notes panel for the active note that ranks other nodes by similarity to the active note's Card vector fused with its graph neighbors, SHALL exclude the note itself, and SHALL work without the model downloaded when vectors exist in the store.

#### Scenario: Model not downloaded
- **WHEN** a phone has no model weights but its store was filled from the vector pack
- **THEN** the related notes panel lists related notes

### Requirement: Copy context pack
The plugin SHALL offer a command and a button that retrieve a context pack for the current query and copy it to the clipboard as markdown with a citation link per passage and the connecting relationships, and SHALL NOT send it anywhere.

#### Scenario: Copy
- **WHEN** the user selects "Copy context pack" for a query
- **THEN** the clipboard holds cited passages and a notice gives the character count

### Requirement: Indexing never interrupts editing on mobile
On mobile the vector phase SHALL run only while the app is in the foreground and the user has been idle for 2 seconds, SHALL pause when the app is hidden, and SHALL stop when indexing is paused for this device.

#### Scenario: User typing
- **WHEN** the user is typing in a note on a phone
- **THEN** no embedding batch starts until 2 seconds after the last keystroke
